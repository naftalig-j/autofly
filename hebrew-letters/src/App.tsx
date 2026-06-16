import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import LearnMode from './components/LearnMode';
import QuizMode from './components/QuizMode';

type Screen = 'welcome' | 'learn' | 'quiz';

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');

  return (
    <>
      {screen === 'welcome' && (
        <WelcomeScreen onStart={mode => setScreen(mode)} />
      )}
      {screen === 'learn' && (
        <LearnMode onBack={() => setScreen('welcome')} />
      )}
      {screen === 'quiz' && (
        <QuizMode onBack={() => setScreen('welcome')} />
      )}
    </>
  );
}
