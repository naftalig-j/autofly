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
      <div className="relative z-10 text-center px-6 max-w-sm w-full flex flex-col items-center">

        {/* Lya's photo */}
        <div className="relative mb-2">
          <div className="w-44 h-44 rounded-full overflow-hidden border-4 border-white shadow-2xl"
               style={{ boxShadow: '0 0 0 6px rgba(255,255,255,0.3), 0 8px 32px rgba(0,0,0,0.4)' }}>
            <img src="/autofly/hebrew-letters/lya.png" alt="ליה"
                 className="w-full h-full object-cover object-top" />
          </div>
          {/* little star badge */}
          <div className="absolute -bottom-1 -right-1 text-4xl animate-bounce">⭐</div>
        </div>

        <h1 className="text-white font-extrabold mb-1 mt-3" style={{ fontSize: '2.8rem', direction: 'rtl' }}>
          שלום ליה!
        </h1>
        <p className="text-white/80 text-xl mb-8 font-medium" style={{ direction: 'rtl' }}>
          בואי ללמוד את האלפבית העברי 🎉
        </p>

        <div className="flex flex-col gap-4 w-full">
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

        <p className="text-white/50 text-sm mt-6">22 אותיות • צלילים • כיף!</p>
      </div>
    </div>
  );
}
