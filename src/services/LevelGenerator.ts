/**
 * src/services/LevelGenerator.ts
 * Sinh ngẫu nhiên các màn chơi (LevelData) từ pool asset có sẵn.
 * Hoàn toàn không biết về domain Animal/Fruit/... — chỉ biết id và asset path.
 * Tuân thủ Rule 4 (Domain-agnostic) và Rule 3 (Config-driven).
 */

import type { LevelData } from '../types/engine';
import { SVG_ASSETS } from '../assets/SVGs';
import { ANIMAL_TRANSLATIONS } from '../data/animal_translations';
import { GENERAL_TRANSLATIONS } from '../data/general_translations';

/** Số lựa chọn hiển thị cho mỗi câu hỏi tap */
const TAP_CHOICES = 4;
/** Số màn chơi mặc định mỗi round */
const DEFAULT_ROUND_SIZE = 6;

/** Danh sách côn trùng tách từ danh sách động vật chung */
const INSECT_POOL = [
  'ant', 'beetle', 'bug', 'butterfly', 'cricket', 'fly', 
  'mosquito', 'scorpion', 'snail', 'spider', 'worm'
];

/** Danh sách rau quả thơm ngon */
const FRUIT_VEG_POOL = [
  "grapes", "melon", "watermelon", "tangerine", "lemon", "lime", "banana", "pineapple", "mango",
  "red-apple", "green-apple", "pear", "peach", "cherries", "strawberry", "blueberries", "kiwi-fruit",
  "tomato", "olive", "coconut", "avocado", "eggplant", "potato", "carrot", "ear-of-corn",
  "hot-pepper", "bell-pepper", "cucumber", "leafy-green", "broccoli", "garlic", "onion",
  "peanuts", "beans", "chestnut", "ginger-root", "pea-pod", "brown-mushroom", "root-vegetable"
];

/** Danh sách đồ ăn và đồ ngọt */
const FOOD_POOL = [
  "bread", "croissant", "baguette-bread", "flatbread", "pretzel", "bagel", "pancakes", "waffle",
  "cheese-wedge", "meat-on-bone", "poultry-leg", "cut-of-meat", "bacon", "hamburger", "french-fries",
  "pizza", "hot-dog", "sandwich", "taco", "burrito", "tamale", "stuffed-flatbread", "falafel",
  "egg", "popcorn", "butter", "rice-cracker", "rice-ball", "cooked-rice", "curry-rice",
  "steaming-bowl", "spaghetti", "roasted-sweet-potato", "oden", "sushi", "fried-shrimp",
  "fish-cake-with-swirl", "moon-cake", "dango", "dumpling", "fortune-cookie", "soft-ice-cream",
  "shaved-ice", "ice-cream"
];

/**
 * Lấy danh sách tất cả animal ID từ SVG_ASSETS (bỏ qua UI assets).
 * UI assets có key không chứa dấu '-' và thuộc nhóm flag/star/sound.
 */
function getAnimalPool(): string[] {
  const UI_KEYS = new Set([
    'flag_vi', 'flag_en', 'flag_zh', 'flag_ja', 'star', 'sound_on', 'sound_off',
    'grapes', 'melon', 'watermelon', 'tangerine', 'lemon', 'lime', 'banana', 'pineapple', 'mango',
    'red-apple', 'green-apple', 'pear', 'peach', 'cherries', 'strawberry', 'blueberries', 'kiwi-fruit',
    'tomato', 'olive', 'coconut', 'avocado', 'eggplant', 'potato', 'carrot', 'ear-of-corn',
    'hot-pepper', 'bell-pepper', 'cucumber', 'leafy-green', 'broccoli', 'garlic', 'onion',
    'peanuts', 'beans', 'chestnut', 'ginger-root', 'pea-pod', 'brown-mushroom', 'root-vegetable',
    'bread', 'croissant', 'baguette-bread', 'flatbread', 'pretzel', 'bagel', 'pancakes', 'waffle',
    'cheese-wedge', 'meat-on-bone', 'poultry-leg', 'cut-of-meat', 'bacon', 'hamburger', 'french-fries',
    'pizza', 'hot-dog', 'sandwich', 'taco', 'burrito', 'tamale', 'stuffed-flatbread', 'falafel',
    'egg', 'popcorn', 'butter', 'rice-cracker', 'rice-ball', 'cooked-rice', 'curry-rice',
    'steaming-bowl', 'spaghetti', 'roasted-sweet-potato', 'oden', 'sushi', 'fried-shrimp',
    'fish-cake-with-swirl', 'moon-cake', 'dango', 'dumpling', 'fortune-cookie', 'soft-ice-cream',
    'shaved-ice', 'ice-cream'
  ]);
  return Object.keys(SVG_ASSETS).filter(k => !UI_KEYS.has(k));
}

/** Tra cứu dịch thuật của một phần tử */
export function getTranslation(key: string, lang: string): string {
  if (ANIMAL_TRANSLATIONS[key]) {
    return ANIMAL_TRANSLATIONS[key][lang] || key;
  }
  if (GENERAL_TRANSLATIONS[key]) {
    return GENERAL_TRANSLATIONS[key][lang] || key;
  }
  return key.replace(/-/g, ' ');
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
 * Sinh ngẫu nhiên một round game cho một chủ đề cụ thể (animals, insects, fruits, foods).
 */
export function generateRoundForCategory(
  category: string,
  count: number = DEFAULT_ROUND_SIZE,
  lang: string = 'en'
): LevelData[] {
  let pool: string[] = [];

  if (category === 'animals') {
    // Chỉ lấy động vật không xương sống/có xương sống, bỏ bớt côn trùng
    const allAnimals = getAnimalPool();
    pool = allAnimals.filter(id => !INSECT_POOL.includes(id));
  } else if (category === 'insects') {
    pool = INSECT_POOL;
  } else if (category === 'fruits') {
    pool = FRUIT_VEG_POOL;
  } else if (category === 'foods') {
    pool = FOOD_POOL;
  } else {
    pool = getAnimalPool();
  }

  // Tăng cường bảo mật: loại bỏ các key không tồn tại trong SVG_ASSETS
  pool = pool.filter(key => !!SVG_ASSETS[key]);

  if (pool.length < TAP_CHOICES) {
    console.warn(`[LevelGenerator] Not enough items in pool to generate a round for category: ${category}`);
    return [];
  }

  const selected = sample(pool, Math.min(count, pool.length));
  
  // Xác định câu lệnh hướng dẫn bằng tiếng Việt/tiếng Anh
  let voicePrefix = '';
  if (lang === 'vi') {
    if (category === 'animals') voicePrefix = 'Hãy chạm vào con';
    else if (category === 'insects') voicePrefix = 'Bé hãy tìm con';
    else if (category === 'fruits') {
      voicePrefix = 'Bé hãy tìm';
    } else if (category === 'foods') {
      voicePrefix = 'Bé hãy chọn';
    } else {
      voicePrefix = 'Hãy chạm vào';
    }
  } else {
    voicePrefix = 'Tap the';
  }

  return selected.map((correct, i) => {
    const name = getTranslation(correct, lang);
    
    // Tinh chỉnh câu đọc tiếng Việt cho chuẩn tự nhiên:
    // ví dụ "Bé hãy tìm quả táo" thay vì "Bé hãy tìm Quả táo"
    let cleanName = name;
    if (lang === 'vi') {
      if (cleanName.toLowerCase().startsWith('con ')) {
        // Cắt bớt chữ "con" nếu prefix đã có "con"
        if (category === 'animals' || category === 'insects') {
          cleanName = cleanName.substring(4);
        }
      }
    }
    
    const voiceText = `${voicePrefix} ${cleanName}`;
    return generateTapLevel(correct, pool, i, voiceText);
  });
}

/**
 * Sinh một round gồm `count` màn chơi từ animal pool (tương thích ngược).
 */
export function generateRound(
  count: number = DEFAULT_ROUND_SIZE,
  lang: string = 'en'
): LevelData[] {
  return generateRoundForCategory('animals', count, lang);
}
