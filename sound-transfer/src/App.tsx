import { useState } from 'react';
import { SendPanel }    from './components/SendPanel';
import { ReceivePanel } from './components/ReceivePanel';

type Tab = 'send' | 'receive';

export default function App() {
  const [tab, setTab] = useState<Tab>('send');

  return (
    <div className="min-h-screen bg-[#080f1e] text-slate-100 flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="w-full max-w-lg mb-8 text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sonic-950/60 border border-sonic-800/40 text-sonic-400 text-xs font-semibold tracking-widest uppercase mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sonic-400 animate-pulse" />
          MFSK-16 Audio Link
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-sonic-300 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
          SonicTransfer
        </h1>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Send text and images over sound using 16-tone frequency-shift keying
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg">
        {/* Tab bar */}
        <div className="flex rounded-xl bg-slate-900/70 border border-slate-800 p-1 mb-5 gap-1">
          {(['send', 'receive'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t
                  ? 'bg-slate-700 text-slate-100 shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'send' ? '📡  Send' : '🎙  Receive'}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-2xl">
          {tab === 'send'    ? <SendPanel />    : <ReceivePanel />}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-slate-700">
        Works best in a quiet room · Max payload ~512 bytes · Chrome / Edge recommended
      </p>
    </div>
  );
}
