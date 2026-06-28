/**
 * tools/openmoji/generator.ts
 * Ghi các file output: asset.svg, metadata.json, index.json, content/*.json
 * Không chỉnh sửa SVG — copy nguyên bản từ OpenMoji.
 */

import fs from 'fs';
import path from 'path';
import type { ImportedAsset, ImportStats, ContentEntry, ProjectCategory } from './types.js';
import { ALL_CATEGORIES } from './mapper.js';

/**
 * Ghi một asset (SVG + metadata.json) vào thư mục đích.
 * Cấu trúc: assets/{category}/{id}/asset.svg + metadata.json
 */
export function writeAsset(asset: ImportedAsset, projectRoot: string): void {
  const assetDir = path.join(projectRoot, 'assets', asset.category, asset.id);
  fs.mkdirSync(assetDir, { recursive: true });

  // Copy SVG nguyên bản — không chỉnh sửa, không tối ưu
  const destSvg = path.join(assetDir, 'asset.svg');
  fs.copyFileSync(asset.svgSourcePath, destSvg);

  // Ghi metadata.json
  const destMeta = path.join(assetDir, 'metadata.json');
  fs.writeFileSync(destMeta, JSON.stringify(asset.metadata, null, 2), 'utf-8');
}

/**
 * Sinh file assets/index.json liệt kê tất cả ID theo từng category.
 */
export function writeIndex(
  assets: ImportedAsset[],
  projectRoot: string
): void {
  const index: Record<string, string[]> = {};

  // Khởi tạo tất cả category với mảng rỗng để đảm bảo thứ tự nhất quán
  for (const cat of ALL_CATEGORIES) {
    index[cat] = [];
  }

  for (const asset of assets) {
    index[asset.category].push(asset.id);
  }

  const indexPath = path.join(projectRoot, 'assets', 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Sinh các file content/{category}.json với danh sách { id, asset } cho mỗi category.
 */
export function writeContentFiles(
  assets: ImportedAsset[],
  projectRoot: string
): void {
  const contentDir = path.join(projectRoot, 'content');
  fs.mkdirSync(contentDir, { recursive: true });

  // Nhóm assets theo category
  const byCategory = new Map<ProjectCategory, ContentEntry[]>();

  for (const cat of ALL_CATEGORIES) {
    byCategory.set(cat, []);
  }

  for (const asset of assets) {
    const entry: ContentEntry = {
      id: asset.id,
      asset: `${asset.category}/${asset.id}/asset.svg`,
    };
    byCategory.get(asset.category)!.push(entry);
  }

  // Ghi từng file
  for (const [cat, entries] of byCategory) {
    if (entries.length === 0) continue;
    const filePath = path.join(contentDir, `${cat}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  }
}

/**
 * Tính toán và trả về thống kê import.
 */
export function buildStats(
  assets: ImportedAsset[],
  warnings: string[]
): ImportStats {
  const byCategory: Record<string, number> = {};

  for (const cat of ALL_CATEGORIES) {
    byCategory[cat] = 0;
  }

  for (const asset of assets) {
    byCategory[asset.category]++;
  }

  return {
    byCategory,
    total: assets.length,
    errors: warnings,
  };
}

/**
 * Tạo thư mục assets/{category}/ cho tất cả category được hỗ trợ.
 */
export function ensureAssetDirectories(projectRoot: string): void {
  for (const cat of ALL_CATEGORIES) {
    fs.mkdirSync(path.join(projectRoot, 'assets', cat), { recursive: true });
  }
}
