import { useState, useEffect } from 'react';
import { LETTERS } from '../data/letters';

interface Props {
  onStart: (mode: 'learn' | 'quiz') => void;
}

const FLOATING = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ל', 'מ', 'נ', 'ש', 'ת'];

export default function WelcomeScreen({ onStart }: Props) {
  const [floaters] = useState(() =>
    FLOATING.map((l, i) => ({
      letter: l,
      color: LETTERS.find(x => x.letter === l)?.color ?? '#A29BFE',
      x: 5 + (i / FLOATING.length) * 90,
      delay: i * 0.3,
      duration: 3 + (i % 3),
    }))
  );

  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>

      {/* floating letters background */}
      {floaters.map((f, i) => (
        <div
          key={i}
          className="absolute text-white/20 font-bold select-none pointer-events-none animate-bounce"
          style={{
            left: `${f.x}%`,
            top: `${10 + (i % 4) * 20}%`,
            fontSize: '4rem',
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
          }}
        >
          {f.letter}
        </div>
      ))}

      {/* main card */}
      <div className="relative z-10 text-center px-6 max-w-sm w-full">
        <div className="text-8xl mb-4 animate-bounce">⭐</div>
        <h1 className="text-white font-extrabold mb-2" style={{ fontSize: '2.8rem', direction: 'rtl' }}>
          שלום ליה!
        </h1>
        <p className="text-white/80 text-xl mb-10 font-medium" style={{ direction: 'rtl' }}>
          בואי ללמוד את האלפבית העברי 🎉
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => onStart('learn')}
            className="group relative overflow-hidden rounded-3xl py-5 px-8 text-2xl font-bold text-white shadow-2xl transition-transform active:scale-95 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF9F43)' }}
          >
            <span className="relative z-10">📚 ללמוד אותיות</span>
          </button>

          <button
            onClick={() => onStart('quiz')}
            className="group relative overflow-hidden rounded-3xl py-5 px-8 text-2xl font-bold text-white shadow-2xl transition-transform active:scale-95 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #4ECDC4, #44B0A8)' }}
          >
            <span className="relative z-10">🎮 משחק ניחוש</span>
          </button>
        </div>

        <p className="text-white/50 text-sm mt-8">22 אותיות • צלילים • כיף!</p>
      </div>
    </div>
  );
}
