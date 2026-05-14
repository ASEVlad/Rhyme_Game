import { DEFAULT_LANGUAGE, getLanguage, type LanguageId } from './languages';

const STORAGE_KEY = 'rhyme-language';

function readStorage(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function sniffNavigator(): string | null {
  try {
    if (typeof navigator === 'undefined') return null;
    const raw = navigator.language;
    if (typeof raw !== 'string' || raw.length === 0) return null;
    return raw.split('-')[0]!.toLowerCase();
  } catch {
    return null;
  }
}

export function loadLanguage(): LanguageId {
  const stored = readStorage();
  if (stored) {
    const fromStored = getLanguage(stored);
    if (fromStored.id === stored) return fromStored.id;
  }
  const sniffed = sniffNavigator();
  if (sniffed) {
    const fromSniff = getLanguage(sniffed);
    if (fromSniff.id === sniffed) return fromSniff.id;
  }
  return DEFAULT_LANGUAGE;
}

export function saveLanguage(id: LanguageId): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // best-effort; ignore
  }
}
