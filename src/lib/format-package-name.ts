// Package titles are typed by photographers, and plenty of them arrive in
// running case ("surprise proposal", "lisbon story"). They sit next to a price
// as the heading of a card, so they read as titles — capitalise them.
//
// The transform only ever RAISES the first letter of a word. It never lowers
// anything, so "NYC", "iPhone shoot" and a deliberately styled name survive
// untouched. Small connecting words stay lowercase in the middle of a title,
// the way a title normally reads: "Sessão de Família", "Best of Lisbon".

// Connectors across the five languages the platform sells in. Only consulted
// for words that are not first or last.
const MINOR_WORDS = new Set([
  // English
  "a", "an", "the", "and", "or", "but", "nor", "of", "for", "in", "on", "at",
  "to", "by", "from", "with", "into", "over", "per", "vs",
  // Portuguese / Spanish (including the em+artigo contractions: "no Porto",
  // "na Praia", "às Ilhas" — these are prepositions, not words to raise)
  "de", "da", "do", "dos", "das", "del", "la", "el", "los", "las", "lo",
  "um", "uma", "un", "una", "y", "e", "o", "em", "en", "con", "por", "para", "sin",
  "no", "na", "nos", "nas", "ao", "aos", "à", "às", "pelo", "pela", "num", "numa",
  // Italian
  "di", "della", "dello", "dei", "degli", "delle", "il", "lo", "gli", "nel",
  "nella", "sul", "sulla", "alla", "al", "dal", "dalla", "su", "tra", "fra",
  // French
  "du", "des", "le", "les", "et", "aux", "au", "à", "avec", "sur", "chez", "dans",
  // German (articles; nouns keep their own capitals anyway)
  "der", "die", "das", "den", "dem", "und", "mit", "für", "von", "im", "am",
  "auf", "aus", "bei", "beim", "nach", "vom", "zu", "zum", "zur",
]);

function raiseFirstLetter(word: string): string {
  // A word that already carries a capital somewhere is styled on purpose —
  // "iPhone" must not become "IPhone", "eBook" must not become "EBook".
  if (/\p{Lu}/u.test(word)) return word;

  // Walk past anything that cannot carry a case — "(golden" and "«sunset"
  // should still capitalise the letter, not give up at the bracket.
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (ch.toLowerCase() !== ch.toUpperCase()) {
      return word.slice(0, i) + ch.toUpperCase() + word.slice(i + 1);
    }
  }
  return word;
}

function capitalizeWord(word: string): string {
  // Elided articles keep their small letter: "Histoire d'amour", "L'estate".
  // Raising the letter before the apostrophe reads as a typo in French and
  // Italian, which is where these show up.
  if (/^\p{L}['’]/u.test(word)) return word;

  // Hyphens and slashes join two titles, so both halves get capitalised:
  // "mini-session" → "Mini-Session", "couple/family" → "Couple/Family".
  for (const sep of ["-", "/"]) {
    if (word.includes(sep)) {
      return word.split(sep).map(capitalizeWord).join(sep);
    }
  }
  return raiseFirstLetter(word);
}

/**
 * Title-case a package name for display.
 * "surprise proposal" → "Surprise Proposal"
 * "sessão de família" → "Sessão de Família"
 * "SUNSET & beach"    → "SUNSET & Beach"   (existing capitals kept)
 */
export function titleCasePackageName(name: string): string {
  if (!name) return name;

  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return name;

  const words = trimmed.split(" ");

  // Some photographers put a whole explanatory sentence in the name field
  // ("Proposal Photoshoot (Pack 2) - This package applies only to the islands
  // of…"). A sentence read in title case is worse than one left alone, so
  // anything past title length is returned untouched.
  if (words.length > 7) return name;

  return words
    .map((word, i) => {
      const isEdge = i === 0 || i === words.length - 1;
      // A word the photographer already capitalised stays as typed, minor or
      // not — "Sessions IN Lisbon" is their call, not ours.
      if (!isEdge && MINOR_WORDS.has(word.toLowerCase()) && word === word.toLowerCase()) {
        return word;
      }
      return capitalizeWord(word);
    })
    .join(" ");
}
