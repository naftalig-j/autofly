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

function makeUtterance(text: string, voice: SpeechSynthesisVoice | null, isHebrew: boolean): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.rate  = 0.75;
  u.pitch = 1.1;
  if (isHebrew && voice) {
    u.voice = voice;
    u.lang  = voice.lang;
  } else {
    u.lang = 'en-US';
  }
  return u;
}

export function speak(opts: SpeakOptions | string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const { voice, isHebrew } = getBestVoice();
  const text = typeof opts === 'string' ? opts : (isHebrew ? opts.hebrew : opts.english);
  window.speechSynthesis.speak(makeUtterance(text, voice, isHebrew));
}

/** Say the letter name, pause, then say the example word */
export function speakLetterAndWord(nameOpts: SpeakOptions, wordHebrew: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const { voice, isHebrew } = getBestVoice();

  const nameText = isHebrew ? nameOpts.hebrew : nameOpts.english;
  const wordText = isHebrew ? wordHebrew     : wordHebrew; // word is always Hebrew; Carmit handles it fine

  window.speechSynthesis.speak(makeUtterance(nameText, voice, isHebrew));
  // Queue the word — browsers play utterances in order
  window.speechSynthesis.speak(makeUtterance(wordText, voice, isHebrew));
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
