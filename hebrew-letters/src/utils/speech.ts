export function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'he-IL';
  utterance.rate = 0.8;
  utterance.pitch = 1.1;

  const voices = window.speechSynthesis.getVoices();
  const hebrewVoice = voices.find(v => v.lang.startsWith('he'));
  if (hebrewVoice) utterance.voice = hebrewVoice;

  window.speechSynthesis.speak(utterance);
}

export function ensureVoicesLoaded(): Promise<void> {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(); return; }
    window.speechSynthesis.onvoiceschanged = () => resolve();
    setTimeout(resolve, 1000);
  });
}
