export interface HebrewLetter {
  letter: string;
  name: string;
  transliteration: string;
  word: string;
  wordMeaning: string;
  emoji: string;
  color: string;
}

export const LETTERS: HebrewLetter[] = [
  { letter: 'א', name: 'אָלֶף', transliteration: 'Alef', word: 'אֲרִי', wordMeaning: 'אריה', emoji: '🦁', color: '#FF6B6B' },
  { letter: 'ב', name: 'בֵּית', transliteration: 'Bet',  word: 'בַּיִת', wordMeaning: 'בית',  emoji: '🏠', color: '#FF9F43' },
  { letter: 'ג', name: 'גִּימֶל', transliteration: 'Gimel', word: 'גָּמָל', wordMeaning: 'גמל', emoji: '🐪', color: '#FECA57' },
  { letter: 'ד', name: 'דָּלֶת', transliteration: 'Dalet', word: 'דָּג', wordMeaning: 'דג', emoji: '🐟', color: '#48DBFB' },
  { letter: 'ה', name: 'הֵא', transliteration: 'He', word: 'הַר', wordMeaning: 'הר', emoji: '⛰️', color: '#A29BFE' },
  { letter: 'ו', name: 'וָו', transliteration: 'Vav', word: 'וֶרֶד', wordMeaning: 'ורד', emoji: '🌹', color: '#FD79A8' },
  { letter: 'ז', name: 'זַיִן', transliteration: 'Zayin', word: 'זֵבְרָא', wordMeaning: 'זברה', emoji: '🦓', color: '#6C5CE7' },
  { letter: 'ח', name: 'חֵית', transliteration: 'Het', word: 'חָתוּל', wordMeaning: 'חתול', emoji: '🐱', color: '#00B894' },
  { letter: 'ט', name: 'טֵית', transliteration: 'Tet', word: 'טָווָס', wordMeaning: 'טווס', emoji: '🦚', color: '#00CEC9' },
  { letter: 'י', name: 'יוֹד', transliteration: 'Yod', word: 'יֶלֶד', wordMeaning: 'ילד', emoji: '👦', color: '#E17055' },
  { letter: 'כ', name: 'כַּף', transliteration: 'Kaf', word: 'כֶּלֶב', wordMeaning: 'כלב', emoji: '🐕', color: '#FDCB6E' },
  { letter: 'ל', name: 'לָמֶד', transliteration: 'Lamed', word: 'לֵב', wordMeaning: 'לב', emoji: '❤️', color: '#E84393' },
  { letter: 'מ', name: 'מֵם', transliteration: 'Mem', word: 'מַיִם', wordMeaning: 'מים', emoji: '💧', color: '#74B9FF' },
  { letter: 'נ', name: 'נוּן', transliteration: 'Nun', word: 'נֶשֶׁר', wordMeaning: 'נשר', emoji: '🦅', color: '#A29BFE' },
  { letter: 'ס', name: 'סָמֶך', transliteration: 'Samekh', word: 'סוּס', wordMeaning: 'סוס', emoji: '🐴', color: '#55EFC4' },
  { letter: 'ע', name: 'עַיִן', transliteration: 'Ayin', word: 'עֵץ', wordMeaning: 'עץ', emoji: '🌳', color: '#00B894' },
  { letter: 'פ', name: 'פֵּא', transliteration: 'Pe', word: 'פִּיל', wordMeaning: 'פיל', emoji: '🐘', color: '#6C5CE7' },
  { letter: 'צ', name: 'צָדִי', transliteration: 'Tsadi', word: 'צְבִי', wordMeaning: 'צבי', emoji: '🦌', color: '#FFEAA7' },
  { letter: 'ק', name: 'קוֹף', transliteration: 'Qof', word: 'קוֹף', wordMeaning: 'קוף', emoji: '🐒', color: '#E17055' },
  { letter: 'ר', name: 'רֵישׁ', transliteration: 'Resh', word: 'רִימוֹן', wordMeaning: 'רימון', emoji: '🍎', color: '#D63031' },
  { letter: 'ש', name: 'שִׁין', transliteration: 'Shin', word: 'שֶׁמֶשׁ', wordMeaning: 'שמש', emoji: '☀️', color: '#FDCB6E' },
  { letter: 'ת', name: 'תָּו', transliteration: 'Tav', word: 'תַּפּוּחַ', wordMeaning: 'תפוח', emoji: '🍏', color: '#00B894' },
];
