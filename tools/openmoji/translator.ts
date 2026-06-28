/**
 * tools/openmoji/translator.ts
 * Tra cứu bản dịch cho các tên asset sang VI/JA/ZH.
 * Dữ liệu được đọc từ file translations/animal_translations.json
 * Không hardcode bất kỳ chuỗi dịch nào trong code.
 */

import fs from 'fs';
import path from 'path';
import type { Translations } from './types.js';

/** Cấu trúc của một mục trong file dictionary */
interface DictionaryEntry {
  vi: string;
  ja: string;
  zh: string;
}

/** Kiểu tổng của file dictionary JSON */
type TranslationDictionary = Record<string, DictionaryEntry>;

// Cache dictionary sau lần đọc đầu tiên
let dictionaryCache: TranslationDictionary | null = null;

/**
 * Tải dictionary từ tất cả các file trong thư mục translations/.
 * Merge tất cả dictionary files thành một bảng tra cứu duy nhất.
 */
function loadDictionary(projectRoot: string): TranslationDictionary {
  if (dictionaryCache) return dictionaryCache;

  const dir = path.join(projectRoot, 'translations');
  const merged: TranslationDictionary = {};

  if (!fs.existsSync(dir)) {
    console.warn(`[translator] translations/ directory not found at: ${dir}`);
    dictionaryCache = merged;
    return merged;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data: TranslationDictionary = JSON.parse(raw);
      Object.assign(merged, data);
    } catch (err) {
      console.warn(`[translator] Failed to load dictionary file: ${filePath}`, err);
    }
  }

  dictionaryCache = merged;
  return merged;
}

/**
 * Tạo slug tra cứu từ tên tiếng Anh của emoji.
 * Ví dụ: "Cat Face" → "cat face", "Red Apple" → "red apple"
 */
function toLookupKey(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Tra cứu bản dịch cho một tên emoji.
 * Nếu không tìm thấy trong dictionary, trả về tên tiếng Anh cho tất cả ngôn ngữ (fallback an toàn).
 */
export function translate(name: string, projectRoot: string): Translations {
  const dict = loadDictionary(projectRoot);
  const key = toLookupKey(name);

  const entry = dict[key];
  if (entry) {
    return {
      en: name,
      vi: entry.vi,
      ja: entry.ja,
      zh: entry.zh,
    };
  }

  // Fallback: dùng tên tiếng Anh cho tất cả ngôn ngữ
  return { en: name, vi: name, ja: name, zh: name };
}

/** Reset cache (dùng cho testing) */
export function resetDictionaryCache(): void {
  dictionaryCache = null;
}
