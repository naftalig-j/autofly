import {
  SAMPLE_RATE,
  SYMBOL_DURATION_MS,
  FFT_SIZE,
  ALL_FREQS,
  DATA_FREQS,
  FREQ_SYNC,
  FREQ_END,
  POLL_INTERVAL_MS,
  READINGS_WINDOW,
  MIN_CONSENSUS,
  MIN_PEAK_DB,
  NOISE_HEADROOM_DB,
  PEAK_DOMINANCE_DB,
  CALIBRATION_MS,
  FFT_DB_DISPLAY_MIN,
  FFT_DB_DISPLAY_RANGE,
  BANDPASS_LOW_HZ,
  BANDPASS_HIGH_HZ,
  SYNC_MIN_DURATION_MS,
  HEADER_NIBBLES,
  CHECKSUM_NIBBLES,
  type DecoderState,
  TYPE_TAG_TEXT,
  TYPE_TAG_IMAGE,
} from './protocol';
import { crc8 } from './crc';

// ─── FFT bin pre-computation ──────────────────────────────────────────────────

function freqToBin(freq: number): number {
  return Math.round((freq / SAMPLE_RATE) * FFT_SIZE);
}

const FREQ_BINS = new Map<number, number>(
  ALL_FREQS.map(f => [f, freqToBin(f)]),
);

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DecoderEventMap = {
  state:      (s: DecoderState)                 => void;
  progress:   (received: number, total: number) => void;
  done:       (result: DecodeResult)            => void;
  error:      (msg: string)                     => void;
  spectrum:   (powers: number[])                => void;
  noiseLevel: (floor: number, snr: number)      => void;
};

export interface DecodeResult {
  type: 'text' | 'image' | 'binary';
  text?: string;
  imageDataUrl?: string;
  rawBytes: Uint8Array;
}

// ─── SoundDecoder ─────────────────────────────────────────────────────────────

export class SoundDecoder {
  private audioCtx:   AudioContext  | null = null;
  private analyser:   AnalyserNode  | null = null;
  private streamSrc:  MediaStreamAudioSourceNode | null = null;
  private stream:     MediaStream   | null = null;
  // Float32Array — getFloatFrequencyData returns actual dBFS values (typically −∞…0).
  // We need the full dynamic range: getByteFrequencyData clips to −30 dBFS by default,
  // causing Blackman-window leakage from an adjacent tone (−25 dBFS) to saturate to
  // the same byte value as the real peak (−12 dBFS), making dominance ratio = 1.0.
  private fftData: Float32Array<ArrayBuffer> = new Float32Array(FFT_SIZE) as Float32Array<ArrayBuffer>;
  // We use a Web Worker for the poll loop instead of setInterval because Chrome
  // throttles setInterval in background tabs to 1 Hz after ~5–10 s.  At 1 Hz
  // the 56 ms preamble consensus window can never be filled — the receiver stops
  // working the moment the user switches to the sender tab.  Web Workers are
  // exempt from page timer throttling and always fire at the requested rate.
  private pollWorker: Worker | null = null;
  private stopped     = false;

  // ── Preamble detection (transition-based, consensus window) ───────────────
  private recentFreqs:    number[]      = [];
  private lastStable:     number | null = null;
  private syncDetectedAt: number        = 0;

  // ── Data reading (time-based, one scheduled read per symbol) ─────────────
  // After the preamble we lock a clock and read at fixed SYMBOL_DURATION_MS
  // intervals regardless of whether consecutive symbols share a frequency.
  private dataStartTime:  number = 0;   // estimated start of symbol 0
  private symbolIndex:    number = 0;   // next symbol to read
  private missingReads:   number = 0;   // consecutive null detections

  // ── State machine ──────────────────────────────────────────────────────────
  private state:      DecoderState = 'idle';
  private nibbles:    number[]     = [];
  private payloadLen: number       = 0;

  // ── Adaptive noise floor (in dBFS) ────────────────────────────────────────
  // Set to a very low value until calibration runs.  Loopback skips calibration
  // and initialises to DB_NOISE_FLOOR_INIT (−80 dBFS — essentially silent).
  private noiseFloorDB     = -120;  // calibrated noise ceiling (dBFS)
  private calibrationStart = 0;
  private calibSamples:    number[] = [];  // peak dBFS per poll during calibration

  private listeners: Partial<{ [K in keyof DecoderEventMap]: DecoderEventMap[K][] }> = {};

  // ── Public API ───────────────────────────────────────────────────────────────

  on<K extends keyof DecoderEventMap>(event: K, cb: DecoderEventMap[K]) {
    if (!this.listeners[event]) this.listeners[event] = [];
    (this.listeners[event] as DecoderEventMap[K][]).push(cb);
  }

  off<K extends keyof DecoderEventMap>(event: K, cb: DecoderEventMap[K]) {
    const arr = this.listeners[event] as DecoderEventMap[K][] | undefined;
    if (arr) {
      const idx = arr.indexOf(cb);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  private emit<K extends keyof DecoderEventMap>(event: K, ...args: Parameters<DecoderEventMap[K]>) {
    if (this.stopped) return;
    const arr = this.listeners[event] as ((...a: Parameters<DecoderEventMap[K]>) => void)[] | undefined;
    arr?.forEach(cb => cb(...args));
  }

  /** Start from microphone (normal mode). */
  async start(): Promise<void> {
    this.reset();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await this.audioCtx.resume();
    const hpf = this.buildBandpass(this.audioCtx);
    this.analyser = this.buildAnalyser(this.audioCtx);
    this.streamSrc = this.audioCtx.createMediaStreamSource(this.stream);
    this.streamSrc.connect(hpf.input);
    hpf.output.connect(this.analyser);
    this.fftData = new Float32Array(FFT_SIZE) as Float32Array<ArrayBuffer>;

    this.calibrationStart = performance.now();
    this.calibSamples     = [];
    this.setState('calibrating');
    this.startPollWorker();
  }

  /**
   * Start from an in-memory AudioBuffer (loopback / self-test mode).
   * Bypasses the microphone — no mic permission needed.
   * The buffer is connected directly to the analyser in the same AudioContext.
   */
  async startLoopback(buffer: AudioBuffer): Promise<void> {
    this.reset();
    this.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    // Resume is required — the AudioContext can start suspended when created
    // inside an async callback (even one originally triggered by a user gesture).
    await this.audioCtx.resume();

    const hpf  = this.buildBandpass(this.audioCtx);
    this.analyser = this.buildAnalyser(this.audioCtx);
    this.fftData  = new Float32Array(FFT_SIZE) as Float32Array<ArrayBuffer>;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(hpf.input);
    hpf.output.connect(this.analyser);
    // Also play through speakers so the user can hear the test tones
    hpf.output.connect(this.audioCtx.destination);

    // Skip calibration — digital loopback has essentially zero noise floor
    this.noiseFloorDB = -80;
    this.setState('detecting_sync');
    source.start();
    this.startPollWorker();
  }

  stop() {
    this.stopped = true;
    this.stopPollWorker();
    this.streamSrc?.disconnect();
    this.audioCtx?.close();
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioCtx  = null;
    this.analyser  = null;
    this.streamSrc = null;
    this.stream    = null;
  }

  restart() {
    if (this.stopped) return;
    this.reset();
    this.setState('detecting_sync');
  }

  getState(): DecoderState { return this.state; }

  // ── Audio graph helpers ────────────────────────────────────────────────────

  private buildBandpass(ctx: AudioContext): { input: AudioNode; output: AudioNode } {
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = BANDPASS_LOW_HZ; hpf.Q.value = 0.7;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';  lpf.frequency.value = BANDPASS_HIGH_HZ; lpf.Q.value = 0.7;
    hpf.connect(lpf);
    return { input: hpf, output: lpf };
  }

  // ── Poll-worker helpers ────────────────────────────────────────────────────

  /** Start a Web Worker that messages us every POLL_INTERVAL_MS milliseconds. */
  private startPollWorker() {
    const src = `var id=setInterval(()=>postMessage(0),${POLL_INTERVAL_MS});onmessage=()=>{clearInterval(id);}`;
    const blob = new Blob([src], { type: 'text/javascript' });
    const url  = URL.createObjectURL(blob);
    this.pollWorker = new Worker(url);
    URL.revokeObjectURL(url);
    this.pollWorker.onmessage = () => this.poll();
  }

  private stopPollWorker() {
    if (this.pollWorker) {
      this.pollWorker.postMessage(0);  // signal the worker to clearInterval
      this.pollWorker.terminate();
      this.pollWorker = null;
    }
  }

  private buildAnalyser(ctx: AudioContext): AnalyserNode {
    const a = ctx.createAnalyser();
    a.fftSize = FFT_SIZE;
    a.smoothingTimeConstant = 0.15;
    return a;
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  private reset() {
    this.recentFreqs    = [];
    this.lastStable     = null;
    this.syncDetectedAt = 0;
    this.dataStartTime  = 0;
    this.symbolIndex    = 0;
    this.missingReads   = 0;
    this.state          = 'idle';
    this.nibbles        = [];
    this.payloadLen     = 0;
    // Keep noiseFloorDB so re-listens don't re-calibrate
  }

  private setState(s: DecoderState) {
    this.state = s;
    this.emit('state', s);
  }

  // ── Main poll ──────────────────────────────────────────────────────────────

  private poll() {
    if (!this.analyser) return;

    // Defensively resume the AudioContext — Chrome can silently suspend it
    // after a period of background inactivity or when too many contexts exist.
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
      return; // skip this frame; next poll will run with a live context
    }

    // getFloatFrequencyData returns dBFS values (e.g. −12.0 for a strong bin,
    // −100 or −Infinity for silence).  This preserves the full dynamic range that
    // getByteFrequencyData loses — the byte API clips everything above −30 dBFS
    // to 255, so adjacent-tone Blackman leakage (−25 dBFS) looks identical to the
    // real peak (−12 dBFS), making dominance detection impossible.
    this.analyser.getFloatFrequencyData(this.fftData);

    // dBFS value for each recognised frequency — max of the 3 nearest bins to
    // handle slight FFT-bin misalignment without mixing adjacent tone energies.
    const dBPowers: number[] = ALL_FREQS.map(f => {
      const bin = FREQ_BINS.get(f)!;
      return Math.max(
        isFinite(this.fftData[bin - 1]) ? this.fftData[bin - 1] : -120,
        isFinite(this.fftData[bin])     ? this.fftData[bin]     : -120,
        isFinite(this.fftData[bin + 1]) ? this.fftData[bin + 1] : -120,
      );
    });

    // Convert to 0–1 for the spectrum visualiser.
    // Maps [FFT_DB_DISPLAY_MIN … FFT_DB_DISPLAY_MIN+FFT_DB_DISPLAY_RANGE] → [0…1].
    const powers = dBPowers.map(db =>
      Math.max(0, Math.min(1, (db - FFT_DB_DISPLAY_MIN) / FFT_DB_DISPLAY_RANGE)),
    );
    this.emit('spectrum', powers);

    // ── Calibration ────────────────────────────────────────────────────────
    if (this.state === 'calibrating') {
      this.calibSamples.push(Math.max(...dBPowers));
      const elapsed = performance.now() - this.calibrationStart;
      if (elapsed >= CALIBRATION_MS) {
        const sorted = [...this.calibSamples].sort((a, b) => a - b);
        this.noiseFloorDB = sorted[Math.floor(sorted.length * 0.75)] ?? -80;
        this.emit('noiseLevel', this.noiseFloorDB, 0);
        this.setState('detecting_sync');
      }
      return;
    }

    // Emit live SNR for the UI noise meter (peak − noise floor, in dB)
    const peakDB = Math.max(...dBPowers);
    this.emit('noiseLevel', this.noiseFloorDB, peakDB - this.noiseFloorDB);

    // ── Phase 1: preamble detection (transition-based, consensus window) ──────
    if (this.state === 'detecting_sync') {
      const det = this.detectFrequency(dBPowers);

      this.recentFreqs.push(det ?? -1);
      if (this.recentFreqs.length > READINGS_WINDOW) this.recentFreqs.shift();

      const counts = new Map<number, number>();
      for (const f of this.recentFreqs) counts.set(f, (counts.get(f) ?? 0) + 1);
      let stableFreq: number | null = null;
      for (const [f, c] of counts) if (c >= MIN_CONSENSUS && f !== -1) { stableFreq = f; break; }

      if (stableFreq !== null && stableFreq !== this.lastStable) {
        this.lastStable = stableFreq;
        this.onPreambleSymbol(stableFreq);
      } else if (stableFreq === null) {
        this.lastStable = null;
      }
      return;
    }

    // ── Phase 2: data reading (time-based, one FFT read per symbol slot) ──────
    //
    // Read at 75 % through each 80 ms symbol (60 ms in).
    // With fftSize=2048 the analyser window is 46 ms, so reading at 60 ms means
    // the window spans [14 ms, 60 ms] — entirely inside the current symbol.
    //
    if (this.dataStartTime === 0) return;

    const nextMidpoint = this.dataStartTime + (this.symbolIndex + 0.75) * SYMBOL_DURATION_MS;
    if (performance.now() < nextMidpoint) return;

    const detFreq = this.detectFrequency(dBPowers);

    if (detFreq === null) {
      this.missingReads++;
      if (this.missingReads > 10) {
        this.emit('error', 'Signal lost during reception — move closer or try again.');
        this.resetToSync();
      }
      this.symbolIndex++;
      return;
    }

    this.missingReads = 0;
    this.onDataSymbol(detFreq);
    this.symbolIndex++;
  }

  // ── Preamble handler ──────────────────────────────────────────────────────

  private onPreambleSymbol(freq: number) {
    if (freq === FREQ_SYNC) {
      if (this.syncDetectedAt === 0) this.syncDetectedAt = performance.now();
      return;
    }

    // Non-SYNC: check SYNC duration
    const syncDur = this.syncDetectedAt > 0 ? performance.now() - this.syncDetectedAt : 0;
    this.syncDetectedAt = 0;

    if (syncDur < SYNC_MIN_DURATION_MS) return; // too brief, ignore

    // Valid preamble!  Estimate symbol 0 start time accounting for consensus lag.
    const consensusLag = MIN_CONSENSUS * POLL_INTERVAL_MS; // ≈ 56 ms
    this.dataStartTime = performance.now() - consensusLag;
    this.symbolIndex   = 0;
    this.missingReads  = 0;
    this.nibbles       = [];
    this.recentFreqs   = [];
    this.lastStable    = null;
    this.setState('reading_header');

    // Read symbol 0 (the current freq) immediately — we're already past its midpoint
    this.onDataSymbol(freq);
    this.symbolIndex = 1;
  }

  // ── Data symbol handler ────────────────────────────────────────────────────

  private onDataSymbol(freq: number) {
    if (freq === FREQ_SYNC) {
      // Unexpected new preamble — treat as retransmission
      this.resetToSync();
      this.syncDetectedAt = performance.now();
      return;
    }

    if (freq === FREQ_END) {
      // END tone at the right point seals the packet; otherwise ignore it
      if (this.state === 'reading_checksum' &&
          this.nibbles.length >= this.payloadLen * 2 + CHECKSUM_NIBBLES) {
        this.finalise();
      }
      return;
    }

    const nibble = DATA_FREQS.indexOf(freq);
    if (nibble === -1) return;

    if (this.state === 'reading_header') {
      this.nibbles.push(nibble);
      if (this.nibbles.length === HEADER_NIBBLES) {
        this.payloadLen =
          (this.nibbles[0] << 12) |
          (this.nibbles[1] <<  8) |
          (this.nibbles[2] <<  4) |
           this.nibbles[3];
        this.nibbles = [];
        if (this.payloadLen === 0 || this.payloadLen > 600) {
          this.emit('error', `Bad length ${this.payloadLen} — re-syncing`);
          this.resetToSync();
          return;
        }
        this.setState('reading_data');
        this.emit('progress', 0, this.payloadLen);
      }
      return;
    }

    if (this.state === 'reading_data') {
      this.nibbles.push(nibble);
      if (this.nibbles.length % 2 === 0) {
        this.emit('progress', this.nibbles.length / 2, this.payloadLen);
      }
      if (this.nibbles.length === this.payloadLen * 2) {
        this.setState('reading_checksum');
      }
      return;
    }

    if (this.state === 'reading_checksum') {
      this.nibbles.push(nibble);
      if (this.nibbles.length === this.payloadLen * 2 + CHECKSUM_NIBBLES) {
        this.finalise();
      }
      return;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resetToSync() {
    this.setState('detecting_sync');
    this.syncDetectedAt = 0;
    this.dataStartTime  = 0;
    this.symbolIndex    = 0;
    this.missingReads   = 0;
    this.nibbles        = [];
    this.recentFreqs    = [];
    this.lastStable     = null;
  }

  /**
   * Three-gate frequency detector operating in dBFS space.
   *
   * Using raw dB values (from getFloatFrequencyData) avoids the saturation problem
   * of the byte API: at default maxDecibels=−30 dBFS, a Blackman-window leakage
   * at −25 dBFS clips to the same 255 as the real peak at −12 dBFS, making the
   * dominance ratio 1.0.  In dBFS the same peak/leakage pair gives 13 dB separation,
   * comfortably above the 8 dB gate.
   *
   *  Gate 1 MIN_PEAK_DB:        absolute minimum — "is there any signal?"
   *  Gate 2 NOISE_HEADROOM_DB:  peak must be ≥ N dB above calibrated noise floor.
   *  Gate 3 PEAK_DOMINANCE_DB:  peak must be ≥ N dB above the 2nd-best recognised tone.
   */
  private detectFrequency(dBPowers: number[]): number | null {
    let maxDB = -Infinity, maxIdx = -1, secondDB = -Infinity;
    for (let i = 0; i < dBPowers.length; i++) {
      if (dBPowers[i] > maxDB) { secondDB = maxDB; maxDB = dBPowers[i]; maxIdx = i; }
      else if (dBPowers[i] > secondDB) { secondDB = dBPowers[i]; }
    }

    // Gate 1: absolute minimum — silence / powered-off source
    if (maxDB < MIN_PEAK_DB) return null;

    // Gate 2: above calibrated noise floor
    if (maxDB < this.noiseFloorDB + NOISE_HEADROOM_DB) return null;

    // Gate 3: unambiguous dominance over the next strongest recognised tone
    if (secondDB > -120 && maxDB - secondDB < PEAK_DOMINANCE_DB) return null;

    return ALL_FREQS[maxIdx];
  }

  // ── Finalise ───────────────────────────────────────────────────────────────

  private finalise() {
    const dataNibbles = this.nibbles.slice(0, this.payloadLen * 2);
    const crcNibbles  = this.nibbles.slice(this.payloadLen * 2);

    const payload = new Uint8Array(this.payloadLen);
    for (let i = 0; i < this.payloadLen; i++) {
      payload[i] = (dataNibbles[i * 2] << 4) | dataNibbles[i * 2 + 1];
    }

    const received = (crcNibbles[0] << 4) | crcNibbles[1];
    const computed  = crc8(payload);

    if (received !== computed) {
      this.emit('error',
        `CRC mismatch (rx 0x${received.toString(16).padStart(2,'0')} ≠ ` +
        `0x${computed.toString(16).padStart(2,'0')}) — try closer / quieter.`
      );
      this.resetToSync();
      return;
    }

    this.setState('done');
    this.emit('done', this.buildResult(payload));
    // Immediately reset so the decoder is ready for the next transmission.
    // Without this, the data-reading phase continues firing at stale timing
    // offsets for ~1 second (until missingReads > 10) and misses the next
    // preamble entirely — breaking back-to-back transfers.
    this.resetToSync();
  }

  private buildResult(payload: Uint8Array): DecodeResult {
    const tag  = payload[0];
    const data = payload.slice(1);

    if (tag === TYPE_TAG_TEXT) {
      return { type: 'text', text: new TextDecoder().decode(data), rawBytes: data };
    }
    if (tag === TYPE_TAG_IMAGE) {
      const b64     = btoa(String.fromCharCode(...data));
      const dataUrl = `data:image/jpeg;base64,${b64}`;
      return { type: 'image', imageDataUrl: dataUrl, rawBytes: data };
    }
    return { type: 'binary', rawBytes: data };
  }
}
