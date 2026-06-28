/**
 * tools/openmoji/types.ts
 * Định nghĩa kiểu dữ liệu trung tâm cho toàn bộ công cụ import OpenMoji.
 */

/** Một mục trong file openmoji.json */
export interface OpenMojiEntry {
  emoji: string;
  hexcode: string;
  group: string;
  subgroups: string;
  annotation: string;
  tags: string;
  order: number;
  skintone: string;
  skintone_combination: string;
  skintone_base_emoji: string;
  skintone_base_hexcode: string;
  unicode: string;
  order_emoji: number;
}

/** Nhóm category của project */
export type ProjectCategory =
  | 'animals'
  | 'fruits'
  | 'vegetables'
  | 'foods'
  | 'vehicles'
  | 'weather'
  | 'nature'
  | 'body'
  | 'clothes'
  | 'toys'
  | 'school'
  | 'sports'
  | 'music'
  | 'emoji';

/** Các bản dịch hỗ trợ */
export interface Translations {
  en: string;
  vi: string;
  ja: string;
  zh: string;
}

/** Metadata lưu cùng mỗi asset */
export interface AssetMetadata {
  id: string;
  name: string;
  category: ProjectCategory;
  subgroup: string;
  translations: Translations;
  tags: string[];
}

/** Một asset đã được xử lý hoàn chỉnh */
export interface ImportedAsset {
  id: string;
  category: ProjectCategory;
  svgSourcePath: string;
  metadata: AssetMetadata;
}

/** Kết quả thống kê sau khi chạy import */
export interface ImportStats {
  byCategory: Record<string, number>;
  total: number;
  errors: string[];
}

/** Mục trong content/{category}.json */
export interface ContentEntry {
  id: string;
  asset: string;
}
