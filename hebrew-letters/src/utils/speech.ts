let cachedHebrewVoice: SpeechSynthesisVoice | null | undefined = undefined;

function getHebrewVoice(): SpeechSynthesisVoice | null {
  if (cachedHebrewVoice !== undefined) return cachedHebrewVoice;
  const voices = window.speechSynthesis.getVoices();
  // Prefer a local (non-network) Hebrew voice for reliability
  cachedHebrewVoice =
    voices.find(v => v.lang.startsWith('he') && !v.localService === false) ??
    voices.find(v => v.lang.startsWith('he')) ??
    null;
  return cachedHebrewVoice;
}

export interface SpeakOptions {
  /** Plain Hebrew text (no nikud) — used when Hebrew voice is available */
  hebrew: string;
  /** Fallback text spoken in English when no Hebrew voice is found */
  english: string;
}

export function speak(opts: SpeakOptions | string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const hebrewVoice = getHebrewVoice();

  const utterance = new SpeechSynthesisUtterance();
  utterance.rate  = 0.75;
  utterance.pitch = 1.1;

  if (hebrewVoice) {
    utterance.voice = hebrewVoice;
    utterance.lang  = hebrewVoice.lang;
    utterance.text  = typeof opts === 'string' ? opts : opts.hebrew;
  } else {
    utterance.lang = 'en-US';
    utterance.text = typeof opts === 'string' ? opts : opts.english;
  }

  window.speechSynthesis.speak(utterance);
}

/** Speak two phrases with a short pause between them */
export function speakPair(first: SpeakOptions, second: SpeakOptions) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const hebrewVoice = getHebrewVoice();
  const lang   = hebrewVoice ? hebrewVoice.lang : 'en-US';

  const u1 = new SpeechSynthesisUtterance();
  u1.rate  = 0.75;
  u1.pitch = 1.1;
  u1.lang  = lang;
  u1.text  = hebrewVoice ? first.hebrew  : first.english;
  if (hebrewVoice) u1.voice = hebrewVoice;

  const pause = new SpeechSynthesisUtterance('  ');
  pause.lang = lang;

  const u2 = new SpeechSynthesisUtterance();
  u2.rate  = 0.8;
  u2.pitch = 1.1;
  u2.lang  = lang;
  u2.text  = hebrewVoice ? second.hebrew : second.english;
  if (hebrewVoice) u2.voice = hebrewVoice;

  window.speechSynthesis.speak(u1);
  window.speechSynthesis.speak(pause);
  window.speechSynthesis.speak(u2);
}

export function ensureVoicesLoaded(): Promise<void> {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { cachedHebrewVoice = undefined; resolve(); return; }
    window.speechSynthesis.onvoiceschanged = () => { cachedHebrewVoice = undefined; resolve(); };
    setTimeout(resolve, 1500);
  });
}
