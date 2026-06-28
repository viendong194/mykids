export type GameLanguage = 'vi' | 'en';

class LanguageManager {
  private currentLanguage: GameLanguage;
  private listeners: ((lang: GameLanguage) => void)[] = [];

  constructor() {
    const saved = localStorage.getItem('mykids_lang');
    if (saved === 'vi' || saved === 'en') {
      this.currentLanguage = saved as GameLanguage;
    } else {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('vi')) {
        this.currentLanguage = 'vi';
      } else {
        this.currentLanguage = 'en';
      }
    }
  }

  getLanguage(): GameLanguage {
    return this.currentLanguage;
  }

  setLanguage(lang: GameLanguage) {
    if (this.currentLanguage !== lang) {
      this.currentLanguage = lang;
      localStorage.setItem('mykids_lang', lang);
      this.listeners.forEach((listener) => listener(lang));
    }
  }

  onChange(listener: (lang: GameLanguage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const languageManager = new LanguageManager();
export default languageManager;
