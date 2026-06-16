export interface HebrewLetter {
  letter: string;
  name: string;
  /** Plain Hebrew without nikud — more reliably spoken by TTS engines */
  ttsName: string;
  /** Spoken when no Hebrew voice is available */
  ttsEnglish: string;
  transliteration: string;
  word: string;
  wordMeaning: string;
  emoji: string;
  color: string;
}

export const LETTERS: HebrewLetter[] = [
  { letter: 'א', name: 'אָלֶף',   ttsName: 'אלף',   ttsEnglish: 'alef',   transliteration: 'Alef',   word: 'אֲרִי',    wordMeaning: 'אריה',  emoji: '🦁', color: '#FF6B6B' },
  { letter: 'ב', name: 'בֵּית',   ttsName: 'בית',   ttsEnglish: 'bet',    transliteration: 'Bet',    word: 'בַּיִת',   wordMeaning: 'בית',   emoji: '🏠', color: '#FF9F43' },
  { letter: 'ג', name: 'גִּימֶל', ttsName: 'גימל',  ttsEnglish: 'gimel',  transliteration: 'Gimel',  word: 'גָּמָל',   wordMeaning: 'גמל',   emoji: '🐪', color: '#FECA57' },
  { letter: 'ד', name: 'דָּלֶת',  ttsName: 'דלת',   ttsEnglish: 'dalet',  transliteration: 'Dalet',  word: 'דָּג',     wordMeaning: 'דג',    emoji: '🐟', color: '#48DBFB' },
  { letter: 'ה', name: 'הֵא',     ttsName: 'הא',    ttsEnglish: 'hey',    transliteration: 'He',     word: 'הַר',     wordMeaning: 'הר',    emoji: '⛰️', color: '#A29BFE' },
  { letter: 'ו', name: 'וָו',     ttsName: 'ואו',   ttsEnglish: 'vav',    transliteration: 'Vav',    word: 'וֶרֶד',   wordMeaning: 'ורד',   emoji: '🌹', color: '#FD79A8' },
  { letter: 'ז', name: 'זַיִן',   ttsName: 'זיין',  ttsEnglish: 'zayin',  transliteration: 'Zayin',  word: 'זֵבְרָא', wordMeaning: 'זברה',  emoji: '🦓', color: '#6C5CE7' },
  { letter: 'ח', name: 'חֵית',    ttsName: 'חית',   ttsEnglish: 'khet',   transliteration: 'Het',    word: 'חָתוּל',  wordMeaning: 'חתול',  emoji: '🐱', color: '#00B894' },
  { letter: 'ט', name: 'טֵית',    ttsName: 'טית',   ttsEnglish: 'tet',    transliteration: 'Tet',    word: 'טָווָס',  wordMeaning: 'טווס',  emoji: '🦚', color: '#00CEC9' },
  { letter: 'י', name: 'יוֹד',    ttsName: 'יוד',   ttsEnglish: 'yod',    transliteration: 'Yod',    word: 'יֶלֶד',   wordMeaning: 'ילד',   emoji: '👦', color: '#E17055' },
  { letter: 'כ', name: 'כַּף',    ttsName: 'כף',    ttsEnglish: 'kaf',    transliteration: 'Kaf',    word: 'כֶּלֶב',  wordMeaning: 'כלב',   emoji: '🐕', color: '#FDCB6E' },
  { letter: 'ל', name: 'לָמֶד',   ttsName: 'למד',   ttsEnglish: 'lamed',  transliteration: 'Lamed',  word: 'לֵב',     wordMeaning: 'לב',    emoji: '❤️', color: '#E84393' },
  { letter: 'מ', name: 'מֵם',     ttsName: 'מם',    ttsEnglish: 'mem',    transliteration: 'Mem',    word: 'מַיִם',   wordMeaning: 'מים',   emoji: '💧', color: '#74B9FF' },
  { letter: 'נ', name: 'נוּן',    ttsName: 'נון',   ttsEnglish: 'nun',    transliteration: 'Nun',    word: 'נֶשֶׁר',  wordMeaning: 'נשר',   emoji: '🦅', color: '#A29BFE' },
  { letter: 'ס', name: 'סָמֶך',   ttsName: 'סמך',   ttsEnglish: 'samech', transliteration: 'Samekh', word: 'סוּס',    wordMeaning: 'סוס',   emoji: '🐴', color: '#55EFC4' },
  { letter: 'ע', name: 'עַיִן',   ttsName: 'עיין',  ttsEnglish: 'ayin',   transliteration: 'Ayin',   word: 'עֵץ',     wordMeaning: 'עץ',    emoji: '🌳', color: '#00B894' },
  { letter: 'פ', name: 'פֵּא',    ttsName: 'פא',    ttsEnglish: 'peh',    transliteration: 'Pe',     word: 'פִּיל',   wordMeaning: 'פיל',   emoji: '🐘', color: '#6C5CE7' },
  { letter: 'צ', name: 'צָדִי',   ttsName: 'צדי',   ttsEnglish: 'tsadi',  transliteration: 'Tsadi',  word: 'צְבִי',   wordMeaning: 'צבי',   emoji: '🦌', color: '#FFEAA7' },
  { letter: 'ק', name: 'קוֹף',    ttsName: 'קוף',   ttsEnglish: 'kof',    transliteration: 'Qof',    word: 'קוֹף',    wordMeaning: 'קוף',   emoji: '🐒', color: '#E17055' },
  { letter: 'ר', name: 'רֵישׁ',   ttsName: 'ריש',   ttsEnglish: 'resh',   transliteration: 'Resh',   word: 'רִימוֹן', wordMeaning: 'רימון', emoji: '🍎', color: '#D63031' },
  { letter: 'ש', name: 'שִׁין',   ttsName: 'שין',   ttsEnglish: 'shin',   transliteration: 'Shin',   word: 'שֶׁמֶשׁ', wordMeaning: 'שמש',   emoji: '☀️', color: '#FDCB6E' },
  { letter: 'ת', name: 'תָּו',    ttsName: 'תו',    ttsEnglish: 'tav',    transliteration: 'Tav',    word: 'תַּפּוּחַ', wordMeaning: 'תפוח', emoji: '🍏', color: '#00B894' },
];
