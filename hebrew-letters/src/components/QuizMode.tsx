import { useState, useCallback, useEffect } from 'react';
import { LETTERS, type HebrewLetter } from '../data/letters';
import { speak } from '../utils/speech';
import Celebration from './Celebration';

interface Props {
  onBack: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound(targetIdx: number) {
  const target = LETTERS[targetIdx];
  const others = shuffle(LETTERS.filter((_, i) => i !== targetIdx)).slice(0, 3);
  return { target, choices: shuffle([target, ...others]) };
}

export default function QuizMode({ onBack }: Props) {
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [round, setRound] = useState(() => buildRound(Math.floor(Math.random() * LETTERS.length)));
  const [selected, setSelected] = useState<HebrewLetter | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [shake, setShake] = useState<string | null>(null);

  const nextRound = useCallback(() => {
    setSelected(null);
    setShake(null);
    const newIdx = Math.floor(Math.random() * LETTERS.length);
    setRound(buildRound(newIdx));
  }, []);

  useEffect(() => {
    speak(round.target.name);
  }, [round]);

  const pick = (choice: HebrewLetter) => {
    if (selected) return;
    setSelected(choice);
    setTotal(t => t + 1);

    if (choice.letter === round.target.letter) {
      setScore(s => s + 1);
      setCelebrate(true);
      speak('כל הכבוד! ' + round.target.name);
      setTimeout(() => { setCelebrate(false); nextRound(); }, 1800);
    } else {
      setShake(choice.letter);
      speak('נסי שוב');
      setTimeout(() => { setShake(null); setSelected(null); }, 800);
    }
  };

  const correct = selected?.letter === round.target.letter;

  return (
    <div className="min-h-screen flex flex-col items-center"
         style={{ background: 'linear-gradient(160deg, #fff9f0 0%, #fff3e0 100%)' }}>

      <Celebration show={celebrate} />

      {/* header */}
      <div className="w-full flex items-center justify-between px-4 py-4">
        <button onClick={onBack}
          className="text-3xl rounded-full w-12 h-12 flex items-center justify-center bg-white shadow-md active:scale-90">
          ←
        </button>
        <h2 className="text-xl font-bold text-gray-600" style={{ direction: 'rtl' }}>משחק ניחוש</h2>
        <div className="bg-white rounded-2xl px-4 py-2 shadow text-lg font-bold" style={{ direction: 'rtl' }}>
          ⭐ {score}/{total}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 w-full max-w-sm gap-6">

        {/* question card */}
        <div className="w-full rounded-3xl bg-white shadow-2xl p-8 text-center" style={{ direction: 'rtl' }}>
          <p className="text-gray-500 text-lg mb-3 font-medium">מה האות?</p>
          <div className="text-7xl mb-4">{round.target.emoji}</div>
          <div className="text-3xl font-bold text-gray-800 mb-1">{round.target.name}</div>
          <div className="text-gray-400 text-lg">({round.target.transliteration})</div>

          <button
            onClick={() => speak(round.target.name)}
            className="mt-4 px-6 py-2 rounded-full text-white font-bold text-base transition-transform active:scale-90"
            style={{ background: round.target.color }}
          >
            🔊 שמע שוב
          </button>
        </div>

        {/* choices grid */}
        <div className="grid grid-cols-2 gap-4 w-full">
          {round.choices.map(choice => {
            const isCorrect = choice.letter === round.target.letter;
            const isSelected = selected?.letter === choice.letter;

            let bg = '#ffffff';
            let border = '3px solid #e9ecef';
            if (isSelected && correct)  { bg = '#00B894'; border = '3px solid #00B894'; }
            if (isSelected && !correct) { bg = '#FF6B6B'; border = '3px solid #FF6B6B'; }
            if (selected && isCorrect && !isSelected) { bg = '#d1fae5'; border = '3px solid #00B894'; }

            return (
              <button
                key={choice.letter}
                onClick={() => pick(choice)}
                className="rounded-3xl py-6 shadow-lg font-black text-gray-800 transition-transform active:scale-90 hover:scale-105 flex items-center justify-center"
                style={{
                  fontSize: '4.5rem',
                  background: bg,
                  border,
                  direction: 'rtl',
                  animation: shake === choice.letter ? 'shake 0.4s' : undefined,
                }}
              >
                {choice.letter}
              </button>
            );
          })}
        </div>

        {correct && (
          <div className="text-3xl font-black text-green-600 animate-bounce" style={{ direction: 'rtl' }}>
            כל הכבוד ליה! 🌟
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
