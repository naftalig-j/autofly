import { useRef } from 'react';

interface Props {
  show: boolean;
}

const EMOJIS = ['⭐', '🎉', '🌟', '✨', '🎊', '💫', '🎈'];

export default function Celebration({ show }: Props) {
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      emoji: EMOJIS[i % EMOJIS.length],
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1 + Math.random() * 0.8,
    }))
  );

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.current.map((p, i) => (
        <div
          key={i}
          className="absolute text-4xl select-none"
          style={{
            left: `${p.x}%`,
            top: '-60px',
            animation: `fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        >
          {p.emoji}
        </div>
      ))}
      <style>{`
        @keyframes fall {
          to { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
