/**
 * tools/openmoji/parser.ts
 * Đọc và phân tích file openmoji.json.
 * Lọc chỉ lấy các entry có SVG hợp lệ và thuộc category được project hỗ trợ.
 */

import fs from 'fs';
import path from 'path';
import type { OpenMojiEntry, ImportedAsset, ProjectCategory } from './types.js';
import { mapSubgroupToCategory } from './mapper.js';
import { translate } from './translator.js';

/** Đường dẫn đến OpenMoji repository local */
const OPENMOJI_DIR = 'external/openmoji';
const OPENMOJI_DATA_FILE = path.join(OPENMOJI_DIR, 'data', 'openmoji.json');
const OPENMOJI_SVG_DIR = path.join(OPENMOJI_DIR, 'color', 'svg');

/**
 * Chuyển annotation (tên emoji) sang dạng ID hợp lệ cho file system.
 * Ví dụ: "Cat Face" → "cat-face", "Red Apple" → "red-apple"
 */
function toAssetId(annotation: string): string {
  return annotation
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Đọc toàn bộ openmoji.json và trả về danh sách OpenMojiEntry.
 */
export function readOpenMojiData(projectRoot: string): OpenMojiEntry[] {
  const dataPath = path.join(projectRoot, OPENMOJI_DATA_FILE);

  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `OpenMoji data file not found at: ${dataPath}\n` +
      `Please clone the OpenMoji repository into external/openmoji/`
    );
  }

  const raw = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(raw) as OpenMojiEntry[];
}

/**
 * Phân tích danh sách OpenMojiEntry và lọc ra các asset hợp lệ.
 * - Bỏ qua các emoji có skintone variation (chỉ lấy base)
 * - Bỏ qua các entry không thuộc category nào của project
 * - Bỏ qua các entry không có file SVG tương ứng
 * @param categoryFilter Nếu truyền vào, chỉ giữ lại các asset thuộc category này.
 */
export function parseEntries(
  entries: OpenMojiEntry[],
  projectRoot: string,
  categoryFilter?: string[]
): { assets: ImportedAsset[]; skipped: string[] } {
  const assets: ImportedAsset[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    // Bỏ qua skintone variations — chỉ lấy emoji base
    if (entry.skintone && entry.skintone !== '') continue;

    // Bỏ qua nếu không có annotation
    if (!entry.annotation || entry.annotation.trim() === '') continue;

    // Tìm category ánh xạ
    const category: ProjectCategory | null = mapSubgroupToCategory(entry.subgroups);
    if (!category) continue;

    // Áp dụng filter nếu được truyền vào
    if (categoryFilter && categoryFilter.length > 0) {
      if (!categoryFilter.includes(category)) continue;
    }

    // Kiểm tra file SVG có tồn tại không
    const svgFilename = `${entry.hexcode}.svg`;
    const svgPath = path.join(projectRoot, OPENMOJI_SVG_DIR, svgFilename);

    if (!fs.existsSync(svgPath)) {
      skipped.push(`[WARN] SVG not found for "${entry.annotation}" (${entry.hexcode})`);
      continue;
    }

    const id = toAssetId(entry.annotation);
    const tags = entry.tags
      ? entry.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const translations = translate(entry.annotation, projectRoot);

    assets.push({
      id,
      category,
      svgSourcePath: svgPath,
      metadata: {
        id,
        name: entry.annotation,
        category,
        subgroup: entry.subgroups,
        translations,
        tags,
      },
    });
  }

  return { assets, skipped };
}

