import { useState, useRef, useEffect, useCallback } from 'react';
import { SoundDecoder, type DecodeResult } from '../lib/decoder';
import { type DecoderState, ALL_FREQS, CALIBRATION_MS } from '../lib/protocol';
import { SpectrumVisualizer } from './SpectrumVisualizer';
import { encodeToAudioBuffer, buildTextPayload } from '../lib/encoder';

type ListenPhase = 'idle' | 'starting' | 'active';

export function ReceivePanel() {
  // 'starting' = mic permission requested but not yet granted
  const [phase,       setPhase]       = useState<ListenPhase>('idle');
  const [tabHidden,   setTabHidden]   = useState(false);
  const [state,       setDecState]    = useState<DecoderState>('idle');
  const [progress,    setProgress]    = useState({ rx: 0, total: 0 });
  const [result,      setResult]      = useState<DecodeResult | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [powers,      setPowers]      = useState<number[]>(new Array(ALL_FREQS.length).fill(0));
  const [history,     setHistory]     = useState<DecodeResult[]>([]);
  const [noiseFloor,  setNoiseFloor]  = useState(0);
  const [currentSnr,  setCurrentSnr]  = useState(0);
  const [calibPct,    setCalibPct]    = useState(0);
  const [selfTestStatus, setSelfTestStatus] = useState<'idle'|'running'|'pass'|'fail'>('idle');
  const [selfTestState,  setSelfTestState]  = useState<DecoderState>('idle');
  const [fileDecoding,   setFileDecoding]   = useState(false);
  const [fileError,      setFileError]      = useState('');

  const decoderRef    = useRef<SoundDecoder | null>(null);
  const calibTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef  = useRef<HTMLInputElement | null>(null);

  // ── Cleanup: stop decoder + timers ─────────────────────────────────────────
  const cleanup = useCallback(() => {
    decoderRef.current?.stop();
    decoderRef.current = null;
    if (calibTimerRef.current) {
      clearInterval(calibTimerRef.current);
      calibTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // Warn the user when this tab goes to the background while actively listening.
  // (Even though we now use a Web Worker for the poll loop, keeping the user
  //  aware of tab focus helps diagnose other potential issues.)
  useEffect(() => {
    const handler = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ── Start ───────────────────────────────────────────────────────────────────
  // ── Analyze audio file ─────────────────────────────────────────────────────
  const analyzeFile = async (file: File) => {
    setFileDecoding(true);
    setFileError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx    = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      const decoder = new SoundDecoder();
      decoder.on('done', (r: DecodeResult) => {
        setResult(r);
        setHistory(h => [r, ...h].slice(0, 5));
        setFileDecoding(false);
        decoder.stop();
      });
      decoder.on('error', (msg: string) => {
        setFileError(msg);
        setFileDecoding(false);
        decoder.stop();
      });

      await decoder.startFromBuffer(audioBuffer);
    } catch (e) {
      setFileError(`Failed to read audio file: ${e instanceof Error ? e.message : String(e)}`);
      setFileDecoding(false);
    }
  };

  const startListening = async () => {
    if (phase !== 'idle') return;      // prevent double-start
    setPhase('starting');
    setErrorMsg('');
    setResult(null);
    setProgress({ rx: 0, total: 0 });
    setCalibPct(0);
    setNoiseFloor(0);
    setCurrentSnr(0);

    const decoder = new SoundDecoder();
    decoderRef.current = decoder;

    decoder.on('state',      s  => setDecState(s));
    decoder.on('spectrum',   p  => setPowers(p));
    decoder.on('noiseLevel', (floor, snr) => {
      setNoiseFloor(floor);
      setCurrentSnr(snr);
    });
    decoder.on('progress', (rx, total) => setProgress({ rx, total }));
    decoder.on('done', r => {
      setResult(r);
      setHistory(h => [r, ...h].slice(0, 5));
      setErrorMsg('');   // clear any leftover "Signal lost" from the previous cycle
      decoder.restart();
    });
    decoder.on('error', msg => setErrorMsg(msg));

    try {
      await decoder.start();   // waits for mic permission
      setPhase('active');

      // Calibration progress bar
      const t0 = performance.now();
      calibTimerRef.current = setInterval(() => {
        const pct = Math.min(((performance.now() - t0) / CALIBRATION_MS) * 100, 100);
        setCalibPct(pct);
        if (pct >= 100 && calibTimerRef.current) {
          clearInterval(calibTimerRef.current);
          calibTimerRef.current = null;
        }
      }, 30);
    } catch (err) {
      cleanup();
      setPhase('idle');
      setErrorMsg(
        `Could not access microphone: ${err}. ` +
        `Make sure you allow microphone permission and use Chrome or Edge.`
      );
    }
  };

  // ── Self-test (loopback — no mic needed) ────────────────────────────────────
  // Uses a short 5-char message so the test completes in ~1.5 s.
  const SELF_TEST_MSG = 'Test!';
  const SELF_TEST_TIMEOUT_MS = 10_000;

  const runSelfTest = async () => {
    if (phase !== 'idle') return;
    setSelfTestStatus('running');
    setSelfTestState('idle');
    setErrorMsg('');
    setPowers(new Array(ALL_FREQS.length).fill(0));

    try {
      const payload = buildTextPayload(SELF_TEST_MSG);
      const buffer  = await encodeToAudioBuffer(payload);

      const decoder = new SoundDecoder();
      decoderRef.current = decoder;

      // Show live spectrum and state while the self-test runs
      decoder.on('state',      s => setSelfTestState(s));
      decoder.on('spectrum',   p => setPowers(p));
      decoder.on('noiseLevel', (f, s) => { setNoiseFloor(f); setCurrentSnr(s); });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          decoder.stop();
          decoderRef.current = null;
          setSelfTestStatus('fail');
          setErrorMsg('Self-test timed out — AudioContext may be suspended. Try clicking the button again.');
          reject();
        }, SELF_TEST_TIMEOUT_MS);

        decoder.on('done', r => {
          clearTimeout(timeout);
          decoder.stop();
          decoderRef.current = null;
          if (r.text === SELF_TEST_MSG) {
            setSelfTestStatus('pass');
            setErrorMsg('');
          } else {
            setSelfTestStatus('fail');
            setErrorMsg(`Self-test decoded wrong text: "${r.text}" (expected "${SELF_TEST_MSG}")`);
          }
          setPowers(new Array(ALL_FREQS.length).fill(0));
          resolve();
        });

        decoder.on('error', msg => {
          clearTimeout(timeout);
          decoder.stop();
          decoderRef.current = null;
          setSelfTestStatus('fail');
          setErrorMsg(`Self-test failed: ${msg}`);
          setPowers(new Array(ALL_FREQS.length).fill(0));
          reject(new Error(msg));
        });

        decoder.startLoopback(buffer).catch(err => {
          clearTimeout(timeout);
          setSelfTestStatus('fail');
          setErrorMsg(`Could not start loopback: ${err}`);
          reject(err);
        });
      });
    } catch {
      // error already set above
    } finally {
      setSelfTestState('idle');
    }
  };

  // ── Stop ────────────────────────────────────────────────────────────────────
  const stopListening = () => {
    cleanup();
    setPhase('idle');
    setDecState('idle');
    setPowers(new Array(ALL_FREQS.length).fill(0));
    setProgress({ rx: 0, total: 0 });
    setCalibPct(0);
    setCurrentSnr(0);
  };

  // ── Derived UI state ────────────────────────────────────────────────────────
  const isActive  = phase === 'active';
  const isCalibrating = isActive && state === 'calibrating';

  const stateLabel: Partial<Record<DecoderState, string>> = {
    idle:             'Waiting…',
    calibrating:      'Calibrating noise floor…',
    detecting_sync:   'Listening for signal…',
    reading_header:   'Signal locked — reading header',
    reading_data:     'Receiving data…',
    reading_checksum: 'Verifying packet…',
    done:             'Received!',
    error:            'Error — retrying…',
  };

  const stateDotColor: Partial<Record<DecoderState, string>> = {
    calibrating:      'bg-blue-400 animate-pulse',
    detecting_sync:   'bg-yellow-400 animate-pulse',
    reading_header:   'bg-blue-400 animate-pulse',
    reading_data:     'bg-sonic-400 animate-pulse',
    reading_checksum: 'bg-purple-400 animate-pulse',
    done:             'bg-emerald-400',
    error:            'bg-red-400',
  };

  const stateTextColor: Partial<Record<DecoderState, string>> = {
    calibrating:      'text-blue-400',
    detecting_sync:   'text-yellow-300',
    reading_header:   'text-blue-300',
    reading_data:     'text-sonic-400',
    reading_checksum: 'text-purple-300',
    done:             'text-emerald-400',
    error:            'text-red-400',
  };

  const pct = progress.total > 0 ? Math.round((progress.rx / progress.total) * 100) : 0;

  // noiseFloor is now in dBFS (e.g. −65 = quiet, −30 = loud).  Map to quality.
  const noiseQuality  = noiseFloor < -55 ? 'Excellent' :
                        noiseFloor < -45 ? 'Good' :
                        noiseFloor < -35 ? 'Moderate' : 'High';
  const noiseBarColor = noiseQuality === 'Excellent' ? 'bg-emerald-500' :
                        noiseQuality === 'Good'      ? 'bg-lime-500' :
                        noiseQuality === 'Moderate'  ? 'bg-yellow-500' : 'bg-red-500';
  const noiseLabelClr = noiseQuality === 'Excellent' ? 'text-emerald-400' :
                        noiseQuality === 'Good'      ? 'text-lime-400' :
                        noiseQuality === 'Moderate'  ? 'text-yellow-400' : 'text-red-400';
  // Noise bar: map −80 … −20 dBFS → 0 … 100 % (higher = noisier)
  const noiseBarPct   = Math.min(100, Math.max(0, (noiseFloor + 80) / 60 * 100));

  // currentSnr is now in dB (e.g. 15 = good, 6 = marginal)
  const snrActive  = currentSnr > 8;
  const snrClamped = Math.min(currentSnr / 30, 1);  // 30 dB = full bar

  return (
    <div className="space-y-5">

      {/* ── How it works (shown only when idle) ─────────────────────────────── */}
      {phase === 'idle' && (
        <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-300">How to use</p>
          <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
            <li>
              Open this app on <span className="text-slate-200 font-medium">two devices</span>
              {' '}(or two browser tabs on the same machine)
            </li>
            <li>
              On device <span className="text-sonic-400 font-mono">A</span> — go to the{' '}
              <span className="text-slate-200">📡 Send</span> tab, type a message or pick an image
            </li>
            <li>
              On device <span className="text-sonic-400 font-mono">B</span> — click{' '}
              <span className="text-slate-200">Start Listening</span> below, wait for calibration
            </li>
            <li>
              On device <span className="text-sonic-400 font-mono">A</span> — click{' '}
              <span className="text-slate-200">▶ Transmit</span> and hold it near device B's microphone
            </li>
            <li>Watch the spectrum light up and the data appear here!</li>
          </ol>
        </div>
      )}

      {/* ── Spectrum ────────────────────────────────────────────────────────── */}
      <SpectrumVisualizer powers={powers} active={isActive || selfTestStatus === 'running'} />

      {/* ── Self-test + Start/Stop row ──────────────────────────────────────── */}
      <div className="flex gap-2">
        {/* Self-test button (only when idle) */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={runSelfTest}
              disabled={selfTestStatus === 'running'}
              title="Test the encode→decode pipeline without a microphone"
              className={`flex-none px-4 py-3 rounded-xl font-bold text-xs tracking-wide uppercase transition-all disabled:opacity-50 disabled:cursor-wait border ${
                selfTestStatus === 'pass' ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30' :
                selfTestStatus === 'fail' ? 'border-red-500 text-red-400 bg-red-950/30' :
                selfTestStatus === 'running' ? 'border-yellow-500 text-yellow-300 bg-yellow-950/30 animate-pulse' :
                'border-slate-600 text-slate-400 bg-slate-800/50 hover:border-slate-400 hover:text-slate-200'
              }`}
            >
              {selfTestStatus === 'running' ? '⏳ ~1.5s' :
               selfTestStatus === 'pass'    ? '✓ OK' :
               selfTestStatus === 'fail'    ? '✗ Fail' :
               '⟳ Self-test'}
            </button>
            {selfTestStatus === 'running' && selfTestState !== 'idle' && (
              <span className="text-[10px] text-yellow-400/80 font-mono tracking-tight">
                {selfTestState.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )}

        {/* Main Start / Stop button */}
        <button
          onClick={isActive ? stopListening : phase === 'idle' ? startListening : undefined}
          disabled={phase === 'starting'}
          className={`flex-1 py-3 rounded-xl font-bold text-sm tracking-wide uppercase transition-all disabled:opacity-50 disabled:cursor-wait ${
            isActive
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-sonic-600 hover:bg-sonic-500 text-white shadow-lg shadow-sonic-900/40'
          }`}
        >
          {phase === 'starting' ? '⏳  Requesting mic…' :
           isActive             ? '⬛  Stop Listening'  :
                                  '◎  Start Listening'}
        </button>
      </div>

      {/* Background-tab warning */}
      {isActive && tabHidden && (
        <p className="text-xs text-amber-300 bg-amber-950/30 border border-amber-600/40 rounded-lg px-3 py-2 flex items-center gap-2">
          <span>⚠️</span>
          <span>This tab is in the background — switch back here while waiting for a signal.</span>
        </p>
      )}

      {/* Self-test explainer */}
      {selfTestStatus === 'pass' && phase === 'idle' && (
        <p className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 rounded-lg px-3 py-2">
          ✓ Protocol working — encode→decode pipeline is correct. Now try with two tabs: transmit in one, receive in the other.
        </p>
      )}

      {/* ── Calibration bar ─────────────────────────────────────────────────── */}
      {isCalibrating && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-blue-400 font-medium">Measuring noise floor…</span>
            <span className="text-slate-500 font-mono">{calibPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-100"
              style={{ width: `${calibPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-600">Stay quiet — learning your room's ambient level.</p>
        </div>
      )}

      {/* ── Noise + SNR meters (shown while active and not calibrating) ─────── */}
      {isActive && !isCalibrating && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 p-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">Noise Floor</span>
              <span className={`text-xs font-semibold ${noiseLabelClr}`}>{noiseQuality}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${noiseBarColor}`}
                style={{ width: `${noiseBarPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 p-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">Signal SNR</span>
              <span className={`text-xs font-mono font-semibold ${snrActive ? 'text-sonic-400' : 'text-slate-600'}`}>
                {currentSnr.toFixed(1)} dB
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-100 ${snrActive ? 'bg-sonic-500' : 'bg-slate-600'}`}
                style={{ width: `${snrClamped * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Decoding status ──────────────────────────────────────────────────── */}
      {isActive && !isCalibrating && (
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${stateDotColor[state] ?? 'bg-slate-500'}`} />
          <span className={`font-medium ${stateTextColor[state] ?? 'text-slate-400'}`}>
            {stateLabel[state] ?? state}
          </span>
          {state === 'detecting_sync' && noiseQuality === 'High' && (
            <span className="ml-auto text-xs text-yellow-600">
              ⚠ noisy room — move somewhere quieter
            </span>
          )}
        </div>
      )}

      {/* ── Data receive progress ────────────────────────────────────────────── */}
      {(state === 'reading_data' || state === 'reading_checksum') && progress.total > 0 && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-sonic-500 transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 font-mono">
            <span>{progress.rx} / {progress.total} bytes</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {errorMsg && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg p-3">
          {errorMsg}
        </p>
      )}

      {/* ── Latest result ────────────────────────────────────────────────────── */}
      {result && (
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
              Received — {result.type}
            </span>
            <span className="text-xs font-mono text-slate-500">{result.rawBytes.length} bytes</span>
          </div>

          {result.type === 'text' && (
            <div className="relative">
              <pre className="text-sm text-slate-100 whitespace-pre-wrap break-words font-mono bg-slate-900/60 rounded-lg p-3 max-h-48 overflow-y-auto">
                {result.text}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(result.text ?? '')}
                className="absolute top-2 right-2 text-xs text-slate-500 hover:text-sonic-400 transition"
                title="Copy to clipboard"
              >
                ⎘ Copy
              </button>
            </div>
          )}

          {result.type === 'image' && result.imageDataUrl && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={result.imageDataUrl}
                alt="Received"
                className="max-h-40 rounded-lg border border-slate-700 shadow-lg object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
              <a href={result.imageDataUrl} download="received.jpg"
                className="text-xs text-sonic-400 hover:text-sonic-300 underline">
                ⬇ Download
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── History ─────────────────────────────────────────────────────────── */}
      {history.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Previous</p>
          {history.slice(1).map((r, i) => (
            <div key={i} className="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-400">
              <span className="font-mono text-slate-500">[{r.type}]</span>{' '}
              {r.type === 'text'
                ? (r.text?.slice(0, 80) ?? '') + (r.text && r.text.length > 80 ? '…' : '')
                : `${r.rawBytes.length} bytes`}
            </div>
          ))}
        </div>
      )}

      {/* ── Analyze audio file ───────────────────────────────────────────────── */}
      <div className="border-t border-slate-700/50 pt-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Analyze Audio File</p>
        <p className="text-xs text-slate-500">
          Import a WAV file saved from the Send panel to decode its message offline.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.wav"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) analyzeFile(f); e.target.value = ''; }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={fileDecoding}
          className="w-full py-2 px-4 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {fileDecoding ? '⏳ Analyzing…' : '📂 Open WAV File'}
        </button>

        {/* Drag and drop support */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) analyzeFile(f); }}
          className="flex items-center justify-center border border-dashed border-slate-600 rounded-xl h-12 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          or drag &amp; drop a WAV here
        </div>

        {fileError && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg p-2">
            {fileError}
          </p>
        )}
      </div>
    </div>
  );
}
