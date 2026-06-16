import { useState, useCallback, useEffect } from 'react';
import { LETTERS, type HebrewLetter } from '../data/letters';
import { speak, speakLetterAndWord } from '../utils/speech';
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

function buildRound(target: HebrewLetter) {
  const others = shuffle(LETTERS.filter(l => l.letter !== target.letter)).slice(0, 3);
  return { target, choices: shuffle([target, ...others]) };
}

/** Returns a freshly-shuffled queue of all 22 letters */
function newQueue(): HebrewLetter[] {
  return shuffle([...LETTERS]);
}

export default function QuizMode({ onBack }: Props) {
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  // queue holds letters not yet shown in this cycle
  const [_queue, setQueue] = useState<HebrewLetter[]>(() => {
    const q = newQueue();
    return q.slice(1); // first letter used for initial round
  });
  const [round, setRound] = useState(() => {
    const q = newQueue();
    return buildRound(q[0]);
  });
  const [selected, setSelected] = useState<HebrewLetter | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [shake, setShake] = useState<string | null>(null);
  const [cycleMsg, setCycleMsg] = useState(false);

  const nextRound = useCallback(() => {
    setSelected(null);
    setShake(null);
    setQueue(prev => {
      const remaining = prev.length > 0 ? prev : (() => {
        // completed all 22 — start a new cycle
        setCycleMsg(true);
        setTimeout(() => setCycleMsg(false), 2500);
        return newQueue();
      })();
      const [next, ...rest] = remaining;
      setRound(buildRound(next));
      return rest;
    });
  }, []);

  const sayQuestion = useCallback((letter: typeof round.target) => {
    speakLetterAndWord(
      { hebrew: letter.name, english: letter.ttsEnglish },
      letter.wordMeaning,
    );
  }, []);

  useEffect(() => {
    sayQuestion(round.target);
  }, [round, sayQuestion]);

  const pick = (choice: HebrewLetter) => {
    if (selected) return;
    setSelected(choice);
    setTotal(t => t + 1);

    if (choice.letter === round.target.letter) {
      setScore(s => s + 1);
      setCelebrate(true);
      speak({ hebrew: 'כל הכבוד!', english: 'Great job!' });
      setTimeout(() => { setCelebrate(false); nextRound(); }, 2000);
    } else {
      setShake(choice.letter);
      speak({ hebrew: 'נסי שוב', english: 'Try again' });
      setTimeout(() => { setShake(null); setSelected(null); }, 800);
    }
  };

  const correct = selected?.letter === round.target.letter;

  return (
    <div className="min-h-screen flex flex-col items-center"
         style={{ background: 'linear-gradient(160deg, #fff9f0 0%, #fff3e0 100%)' }}>

      <Celebration show={celebrate} />

      {/* cycle complete banner */}
      {cycleMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-purple-500 text-white text-xl font-bold px-6 py-3 rounded-2xl shadow-2xl animate-bounce"
             style={{ direction: 'rtl' }}>
          🎉 כל הכבוד! סיימת את כל 22 האותיות!
        </div>
      )}

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

        {/* question card — hide everything until after correct guess */}
        <div className="w-full rounded-3xl bg-white shadow-2xl p-8 text-center" style={{ direction: 'rtl' }}>
          <p className="text-gray-500 text-lg mb-4 font-medium">מה האות?</p>

          {/* reveal emoji + word + letter name only after correct guess */}
          <div className="text-7xl mb-3">{round.target.emoji}</div>

          {correct && (
            <div className="mb-4 flex flex-col items-center gap-2">
              <div className="text-4xl font-black text-gray-800">{round.target.wordMeaning}</div>
              <div className="py-2 px-4 rounded-2xl inline-block"
                   style={{ background: round.target.color + '22' }}>
                <span className="font-bold text-xl" style={{ color: round.target.color }}>
                  {round.target.name}
                </span>
                <span className="text-gray-400 text-base mr-2">({round.target.transliteration})</span>
              </div>
            </div>
          )}

          <button
            onClick={() => sayQuestion(round.target)}
            className="block w-full px-6 py-2 rounded-full text-white font-bold text-base transition-transform active:scale-90"
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
            // Only reveal correct/wrong after a correct final answer
            if (isSelected && correct)  { bg = '#00B894'; border = `3px solid #00B894`; }
            if (isSelected && !correct) { bg = '#FF6B6B'; border = '3px solid #FF6B6B'; }
            // Don't highlight the correct answer while the user is still guessing
            if (correct && isCorrect && !isSelected) { bg = '#d1fae5'; border = '3px solid #00B894'; }

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
