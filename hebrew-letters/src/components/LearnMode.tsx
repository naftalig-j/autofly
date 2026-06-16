import { useState } from 'react';
import { LETTERS } from '../data/letters';
import { speak } from '../utils/speech';

interface Props {
  onBack: () => void;
}

export default function LearnMode({ onBack }: Props) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const current = LETTERS[idx];

  const sayLetter = () => {
    setSpeaking(true);
    speak(current.name);
    setTimeout(() => setSpeaking(false), 1500);
  };

  const next = () => { setFlipped(false); setIdx(i => (i + 1) % LETTERS.length); };
  const prev = () => { setFlipped(false); setIdx(i => (i - 1 + LETTERS.length) % LETTERS.length); };

  return (
    <div className="min-h-screen flex flex-col items-center"
         style={{ background: 'linear-gradient(160deg, #f8f9fa 0%, #e9ecef 100%)' }}>

      {/* header */}
      <div className="w-full flex items-center justify-between px-4 py-4">
        <button onClick={onBack}
          className="text-3xl rounded-full w-12 h-12 flex items-center justify-center bg-white shadow-md active:scale-90">
          ←
        </button>
        <h2 className="text-xl font-bold text-gray-600" style={{ direction: 'rtl' }}>
          ללמוד אותיות
        </h2>
        <div className="text-gray-400 font-bold text-lg">{idx + 1} / {LETTERS.length}</div>
      </div>

      {/* progress dots */}
      <div className="flex gap-1 flex-wrap justify-center px-6 mb-6 max-w-sm">
        {LETTERS.map((_l, i) => (
          <button key={i} onClick={() => { setFlipped(false); setIdx(i); }}
            className="w-3 h-3 rounded-full transition-all"
            style={{ background: i === idx ? current.color : i < idx ? '#adb5bd' : '#dee2e6' }} />
        ))}
      </div>

      {/* flashcard */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 w-full max-w-sm">
        <div
          onClick={() => setFlipped(f => !f)}
          className="w-full rounded-3xl shadow-2xl cursor-pointer transition-transform hover:scale-[1.02] active:scale-95 select-none"
          style={{
            background: `linear-gradient(135deg, ${current.color}dd, ${current.color}88)`,
            minHeight: '340px',
          }}
        >
          {!flipped ? (
            /* front: big letter */
            <div className="flex flex-col items-center justify-center h-full p-8 gap-4"
                 style={{ minHeight: '340px' }}>
              <div className="text-white font-black leading-none drop-shadow-lg"
                   style={{ fontSize: '9rem', direction: 'rtl' }}>
                {current.letter}
              </div>
              <div className="text-white/70 text-sm font-medium mt-2">הקש לראות את השם</div>
            </div>
          ) : (
            /* back: name + word + emoji */
            <div className="flex flex-col items-center justify-center h-full p-8 gap-3"
                 style={{ minHeight: '340px', direction: 'rtl' }}>
              <div className="text-white font-black" style={{ fontSize: '4.5rem' }}>
                {current.letter}
              </div>
              <div className="text-white font-bold text-3xl">{current.name}</div>
              <div className="text-white/80 text-lg">({current.transliteration})</div>
              <div className="mt-2 bg-white/20 rounded-2xl px-6 py-3 flex flex-col items-center gap-1">
                <div className="text-5xl">{current.emoji}</div>
                <div className="text-white font-bold text-xl">{current.wordMeaning}</div>
              </div>
            </div>
          )}
        </div>

        {/* speak button */}
        <button
          onClick={sayLetter}
          className="mt-6 rounded-full px-8 py-4 text-white font-bold text-xl shadow-lg transition-transform active:scale-90 hover:scale-105 flex items-center gap-2"
          style={{ background: speaking ? '#6c757d' : current.color }}
        >
          {speaking ? '🔊 מדבר...' : '🔊 שמע את השם'}
        </button>
      </div>

      {/* navigation */}
      <div className="flex gap-6 pb-10 mt-6">
        <button onClick={prev}
          className="rounded-full w-16 h-16 text-3xl bg-white shadow-lg flex items-center justify-center transition-transform active:scale-90 hover:scale-105 font-bold text-gray-600">
          ‹
        </button>
        <button onClick={next}
          className="rounded-full w-16 h-16 text-3xl bg-white shadow-lg flex items-center justify-center transition-transform active:scale-90 hover:scale-105 font-bold text-gray-600">
          ›
        </button>
      </div>
    </div>
  );
}
