import {
  SAMPLE_RATE,
  SYMBOL_DURATION_S,
  FREQ_SYNC,
  FREQ_END,
  DATA_FREQS,
  TYPE_TAG_TEXT,
  TYPE_TAG_IMAGE,
  TYPE_TAG_BINARY,
  type TransferPayloadType,
} from './protocol';
import { crc8 } from './crc';

// ─── Symbol sequence builder ──────────────────────────────────────────────────

function buildSymbolList(payload: Uint8Array): number[] {
  const symbols: number[] = [];

  const pushNibble = (n: number) => symbols.push(DATA_FREQS[n & 0xf]);

  // Preamble: 3 × SYNC
  for (let i = 0; i < 3; i++) symbols.push(FREQ_SYNC);

  // Header: payload length as 4 nibbles (big-endian 16-bit)
  const len = payload.length;
  pushNibble((len >> 12) & 0xf);
  pushNibble((len >> 8)  & 0xf);
  pushNibble((len >> 4)  & 0xf);
  pushNibble(len         & 0xf);

  // Payload bytes → 2 nibbles each
  for (const byte of payload) {
    pushNibble((byte >> 4) & 0xf);
    pushNibble(byte        & 0xf);
  }

  // Checksum: CRC-8 → 2 nibbles
  const crc = crc8(payload);
  pushNibble((crc >> 4) & 0xf);
  pushNibble(crc        & 0xf);

  // Postamble: 3 × END
  for (let i = 0; i < 3; i++) symbols.push(FREQ_END);

  return symbols;
}

// ─── Audio rendering ──────────────────────────────────────────────────────────

/**
 * Renders an MFSK symbol sequence into an AudioBuffer using OfflineAudioContext.
 * Each symbol is a sine wave with a 5 ms fade-in/out to suppress clicks.
 */
export async function encodeToAudioBuffer(
  payload: Uint8Array,
): Promise<AudioBuffer> {
  const symbols = buildSymbolList(payload);
  const totalSamples = symbols.length * Math.floor(SAMPLE_RATE * SYMBOL_DURATION_S);
  const ctx = new OfflineAudioContext(1, totalSamples, SAMPLE_RATE);

  const symbolLen = SYMBOL_DURATION_S;
  const fadeS     = 0.005; // 5 ms fade

  symbols.forEach((freq, i) => {
    const t0 = i * symbolLen;
    const t1 = t0 + symbolLen;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = freq;

    // Ramp up → sustain → ramp down
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.8, t0 + fadeS);
    gain.gain.setValueAtTime(0.8, t1 - fadeS);
    gain.gain.linearRampToValueAtTime(0, t1);

    osc.start(t0);
    osc.stop(t1);
  });

  return ctx.startRendering();
}

// ─── Payload packetisation ────────────────────────────────────────────────────

function taggedPayload(type: TransferPayloadType, data: Uint8Array): Uint8Array {
  const tagMap: Record<TransferPayloadType, number> = {
    text:   TYPE_TAG_TEXT,
    image:  TYPE_TAG_IMAGE,
    binary: TYPE_TAG_BINARY,
  };
  const out = new Uint8Array(1 + data.length);
  out[0] = tagMap[type];
  out.set(data, 1);
  return out;
}

export function buildTextPayload(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);
  return taggedPayload('text', encoded);
}

/** Downscale + JPEG-compress an image to fit within MAX_PAYLOAD_BYTES. */
export async function buildImagePayload(
  file: File,
  maxBytes = 480,
): Promise<{ payload: Uint8Array; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');

      // Scale down: preserve aspect ratio, max 64 px on longest side
      const maxDim = 64;
      const scale  = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);

      const ct = canvas.getContext('2d')!;
      ct.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Try decreasing JPEG quality until it fits
      let quality = 0.7;
      const tryEncode = () => {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const b64     = dataUrl.split(',')[1];
        const bytes   = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        if (bytes.length <= maxBytes || quality < 0.05) {
          resolve({ payload: taggedPayload('image', bytes), dataUrl });
        } else {
          quality -= 0.1;
          tryEncode();
        }
      };
      tryEncode();
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── WAV export ───────────────────────────────────────────────────────────────

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++)
    view.setUint8(offset + i, str.charCodeAt(i));
}

/**
 * Encode an AudioBuffer as a 16-bit mono PCM WAV Blob.
 * Only the first channel is used (the MFSK signal is always mono).
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const samples    = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const numSamples = samples.length;
  const dataBytes  = numSamples * 2;                  // 16-bit = 2 bytes/sample
  const ab         = new ArrayBuffer(44 + dataBytes);
  const view       = new DataView(ab);

  // RIFF chunk
  writeString(view,  0, 'RIFF');
  view.setUint32(    4, 36 + dataBytes, true);
  writeString(view,  8, 'WAVE');
  // fmt  chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(   16, 16,               true);  // chunk size
  view.setUint16(   20,  1,               true);  // PCM
  view.setUint16(   22,  1,               true);  // mono
  view.setUint32(   24, sampleRate,       true);
  view.setUint32(   28, sampleRate * 2,   true);  // byte rate
  view.setUint16(   32,  2,               true);  // block align
  view.setUint16(   34, 16,               true);  // bits per sample
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(   40, dataBytes,        true);
  // PCM samples  (float32 → int16)
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }

  return new Blob([ab], { type: 'audio/wav' });
}

// Estimated transmission time in seconds
export function estimateDuration(payloadBytes: number): number {
  const symbols =
    3 + // preamble
    4 + // header
    payloadBytes * 2 + // data
    2 + // checksum
    3;  // postamble
  return symbols * SYMBOL_DURATION_S;
}
