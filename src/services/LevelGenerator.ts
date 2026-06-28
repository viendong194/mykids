/**
 * src/services/LevelGenerator.ts
 * Sinh ngẫu nhiên các màn chơi (LevelData) từ pool asset có sẵn.
 * Hoàn toàn không biết về domain Animal/Fruit/... — chỉ biết id và asset path.
 * Tuân thủ Rule 4 (Domain-agnostic) và Rule 3 (Config-driven).
 */

import type { LevelData } from '../types/engine';
import { SVG_ASSETS } from '../assets/SVGs';
import { ANIMAL_TRANSLATIONS } from '../data/animal_translations';

/** Số lựa chọn hiển thị cho mỗi câu hỏi tap */
const TAP_CHOICES = 4;
/** Số màn chơi mặc định mỗi round */
const DEFAULT_ROUND_SIZE = 6;

/**
 * Lấy danh sách tất cả animal ID từ SVG_ASSETS (bỏ qua UI assets).
 * UI assets có key không chứa dấu '-' và thuộc nhóm flag/star/sound.
 */
function getAnimalPool(): string[] {
  const UI_KEYS = new Set(['flag_vi', 'flag_en', 'flag_zh', 'flag_ja', 'star', 'sound_on', 'sound_off']);
  return Object.keys(SVG_ASSETS).filter(k => !UI_KEYS.has(k));
}

/** Trộn mảng theo Fisher-Yates */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lấy ngẫu nhiên n phần tử từ mảng, không trùng nhau */
function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

/**
 * Sinh một màn chơi kiểu 'tap' ngẫu nhiên.
 * Chọn 1 correct + 3 distractors từ pool.
 */
function generateTapLevel(
  correct: string,
  pool: string[],
  index: number,
  voiceText: string
): LevelData {
  const distractors = sample(pool.filter(id => id !== correct), TAP_CHOICES - 1);
  const options = shuffle([correct, ...distractors]);

  return {
    id: `generated_tap_${index}`,
    type: 'tap',
    correct,
    options,
    voiceText,
  } as LevelData;
}

/**
 * Sinh một round gồm `count` màn chơi từ animal pool.
 * Đảm bảo không lặp lại animal đúng trong cùng một round.
 * @param count Số màn chơi trong round (mặc định 6)
 * @param lang Mã ngôn ngữ hiện tại ('vi' hoặc 'en')
 */
export function generateRound(
  count: number = DEFAULT_ROUND_SIZE,
  lang: string = 'en'
): LevelData[] {
  const pool = getAnimalPool();

  if (pool.length < TAP_CHOICES) {
    console.warn('[LevelGenerator] Not enough animals in pool to generate a round.');
    return [];
  }

  const selected = sample(pool, Math.min(count, pool.length));
  const voicePrefix = lang === 'vi' ? 'Hãy chạm vào con' : 'Tap the';

  return selected.map((correct, i) => {
    const name = ANIMAL_TRANSLATIONS[correct]?.[lang] || correct.replace(/-/g, ' ');
    
    // Tối ưu hóa chuỗi tiếng Việt: tránh bị "chạm vào con Con mèo"
    let cleanName = name;
    if (lang === 'vi' && cleanName.toLowerCase().startsWith('con ')) {
      cleanName = cleanName.substring(4);
    }
    
    const voiceText = `${voicePrefix} ${cleanName}`;
    return generateTapLevel(correct, pool, i, voiceText);
  });
}
