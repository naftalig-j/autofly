let cachedVoice: SpeechSynthesisVoice | null | undefined = undefined;

function getBestVoice(): { voice: SpeechSynthesisVoice | null; isHebrew: boolean } {
  const voices = window.speechSynthesis.getVoices();
  if (cachedVoice !== undefined) {
    return { voice: cachedVoice, isHebrew: cachedVoice?.lang.startsWith('he') ?? false };
  }
  // Prefer local Hebrew voice (e.g. Carmit on macOS/iOS)
  const heLocal = voices.find(v => v.lang.startsWith('he') && v.localService);
  const heAny   = voices.find(v => v.lang.startsWith('he'));
  cachedVoice = heLocal ?? heAny ?? null;
  return { voice: cachedVoice, isHebrew: cachedVoice?.lang.startsWith('he') ?? false };
}

export interface SpeakOptions {
  /** With nikud — Hebrew TTS voices (Carmit, etc.) pronounce this best */
  hebrew: string;
  /** Spoken when no Hebrew voice is found */
  english: string;
}

export function speak(opts: SpeakOptions | string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const { voice, isHebrew } = getBestVoice();

  const u = new SpeechSynthesisUtterance();
  u.rate  = 0.75;
  u.pitch = 1.1;

  if (isHebrew && voice) {
    u.voice = voice;
    u.lang  = voice.lang;
    u.text  = typeof opts === 'string' ? opts : opts.hebrew;
  } else {
    u.lang = 'en-US';
    u.text = typeof opts === 'string' ? opts : opts.english;
  }

  window.speechSynthesis.speak(u);
}

export function ensureVoicesLoaded(): Promise<void> {
  return new Promise(resolve => {
    if (window.speechSynthesis.getVoices().length > 0) {
      cachedVoice = undefined;
      resolve();
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = undefined;
      resolve();
    };
    setTimeout(resolve, 1500);
  });
}
