import { useState, useRef, useCallback, useEffect } from 'react';
import {
  encodeToAudioBuffer,
  buildTextPayload,
  buildImagePayload,
  estimateDuration,
} from '../lib/encoder';
import { MAX_PAYLOAD_BYTES } from '../lib/protocol';

type SendMode = 'text' | 'image';
type SendStatus = 'idle' | 'encoding' | 'transmitting' | 'done' | 'error';

export function SendPanel() {
  const [mode,      setMode]      = useState<SendMode>('text');
  const [text,      setText]      = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status,    setStatus]    = useState<SendStatus>('idle');
  const [progress,  setProgress]  = useState(0);   // 0–1
  const [errorMsg,  setErrorMsg]  = useState('');
  const [estSeconds, setEstSec]   = useState<number | null>(null);
  const [dragging,  setDragging]  = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef   = useRef<AudioBufferSourceNode | null>(null);
  const rafRef      = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const durationRef  = useRef<number>(0);

  // Clean up on unmount
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.stop();
    audioCtxRef.current?.close();
  }, []);

  const resetState = () => {
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.stop();
    setStatus('idle');
    setProgress(0);
    setErrorMsg('');
  };

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Only image files are supported in image mode.');
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    resetState();
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Estimate size on text change
  useEffect(() => {
    if (mode === 'text' && text) {
      const bytes = new TextEncoder().encode(text).length + 1; // +1 for type tag
      setEstSec(estimateDuration(bytes));
    } else {
      setEstSec(null);
    }
  }, [mode, text]);

  // ── Transmit ───────────────────────────────────────────────────────────────

  const transmit = async () => {
    try {
      resetState();
      setStatus('encoding');

      let payload: Uint8Array;

      if (mode === 'text') {
        if (!text.trim()) { setErrorMsg('Enter some text first.'); setStatus('error'); return; }
        payload = buildTextPayload(text);
      } else {
        if (!imageFile) { setErrorMsg('Select an image first.'); setStatus('error'); return; }
        const result = await buildImagePayload(imageFile);
        setPreviewUrl(result.dataUrl);
        payload = result.payload;
      }

      if (payload.length > MAX_PAYLOAD_BYTES + 10) {
        setErrorMsg(`Payload too large (${payload.length} B). Max ~${MAX_PAYLOAD_BYTES} B.`);
        setStatus('error');
        return;
      }

      const buffer   = await encodeToAudioBuffer(payload);
      const duration = buffer.duration;

      // Close the previous context before creating a new one.  Not doing this
      // leaks AudioContexts — Chrome silently degrades after a few open ones.
      await audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = new AudioContext();
      const source        = audioCtxRef.current.createBufferSource();
      source.buffer       = buffer;
      source.connect(audioCtxRef.current.destination);

      setStatus('transmitting');
      setEstSec(duration);
      startTimeRef.current  = audioCtxRef.current.currentTime;
      durationRef.current   = duration;

      const animate = () => {
        if (!audioCtxRef.current) return;
        const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
        setProgress(Math.min(elapsed / durationRef.current, 1));
        if (elapsed < durationRef.current) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setStatus('done');
          setProgress(1);
        }
      };

      source.onended = () => {
        setStatus('done');
        setProgress(1);
        cancelAnimationFrame(rafRef.current);
      };

      sourceRef.current = source;
      source.start();
      rafRef.current = requestAnimationFrame(animate);
    } catch (err) {
      setErrorMsg(String(err));
      setStatus('error');
    }
  };

  const stop = () => {
    sourceRef.current?.stop();
    cancelAnimationFrame(rafRef.current);
    setStatus('idle');
    setProgress(0);
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const charCount   = new TextEncoder().encode(text).length;
  const charLimit   = 300;
  const charOver    = charCount > charLimit;

  const statusLabel: Record<SendStatus, string> = {
    idle:         'Ready',
    encoding:     'Encoding audio…',
    transmitting: 'Transmitting…',
    done:         'Done!',
    error:        'Error',
  };

  const statusColor: Record<SendStatus, string> = {
    idle:         'text-slate-400',
    encoding:     'text-yellow-400',
    transmitting: 'text-sonic-400',
    done:         'text-emerald-400',
    error:        'text-red-400',
  };

  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div className="flex gap-2">
        {(['text', 'image'] as SendMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); resetState(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold uppercase tracking-wide transition-all ${
              mode === m
                ? 'bg-sonic-600 text-white shadow-lg shadow-sonic-900/50'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {m === 'text' ? '✦ Text' : '⬡ Image'}
          </button>
        ))}
      </div>

      {/* Input area */}
      {mode === 'text' ? (
        <div className="relative">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type your message here…"
            rows={5}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:border-sonic-500 focus:ring-1 focus:ring-sonic-500/30 transition-all"
          />
          <span className={`absolute bottom-3 right-3 text-xs font-mono ${charOver ? 'text-red-400' : 'text-slate-600'}`}>
            {charCount}/{charLimit}
          </span>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative flex flex-col items-center justify-center gap-3 h-44 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
            dragging
              ? 'border-sonic-500 bg-sonic-950/30'
              : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800/50'
          }`}
          onClick={() => document.getElementById('img-file-input')?.click()}
        >
          <input
            id="img-file-input"
            type="file"
            accept="image/*"
            onChange={onFileInput}
            className="hidden"
          />
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="preview"
                className="max-h-28 max-w-full rounded-lg object-contain shadow-lg"
              />
              <span className="text-xs text-slate-500">{imageFile?.name}</span>
            </>
          ) : (
            <>
              <span className="text-3xl">🖼️</span>
              <p className="text-sm text-slate-400">Drop an image or click to browse</p>
              <p className="text-xs text-slate-600">Auto-compressed to ≤ 64×64 px for transmission</p>
            </>
          )}
        </div>
      )}

      {/* Estimate */}
      {estSeconds !== null && status !== 'transmitting' && (
        <p className="text-xs text-slate-500 text-center">
          Estimated transmission time: <span className="text-slate-300 font-mono">{estSeconds.toFixed(1)} s</span>
        </p>
      )}

      {/* Transmit button */}
      <button
        onClick={status === 'transmitting' ? stop : transmit}
        disabled={status === 'encoding' || charOver}
        className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          status === 'transmitting'
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-sonic-600 hover:bg-sonic-500 text-white shadow-lg shadow-sonic-900/40'
        }`}
      >
        {status === 'transmitting' ? '⬛  Stop' : '▶  Transmit over Sound'}
      </button>

      {/* Progress bar */}
      {(status === 'transmitting' || status === 'done') && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${status === 'done' ? 'bg-emerald-500' : 'bg-sonic-500'}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 font-mono">
            <span>{(progress * 100).toFixed(0)}%</span>
            {estSeconds !== null && <span>{(estSeconds * (1 - progress)).toFixed(1)} s left</span>}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {status === 'transmitting' && (
          <span className="inline-block w-2 h-2 rounded-full bg-sonic-400 animate-pulse-slow" />
        )}
        <span className={`font-medium ${statusColor[status]}`}>
          {statusLabel[status]}
        </span>
        {status === 'done' && (
          <button onClick={() => { setStatus('idle'); setProgress(0); }} className="ml-auto text-xs text-slate-500 hover:text-slate-300 underline">
            Reset
          </button>
        )}
      </div>

      {errorMsg && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg p-3">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
