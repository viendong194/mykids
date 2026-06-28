/**
 * tools/openmoji/importer.ts
 * Orchestrator trung tâm: điều phối toàn bộ pipeline import.
 * Parser → Mapper → Translator → Generator
 */

import type { ImportStats } from './types.js';
import { readOpenMojiData, parseEntries } from './parser.js';
import { writeAsset, writeIndex, writeContentFiles, buildStats, ensureAssetDirectories } from './generator.js';

export interface ImportOptions {
  /** Đường dẫn gốc của project (thường là process.cwd()) */
  projectRoot: string;
  /** Nếu true, chỉ hiển thị preview — không ghi file */
  dryRun?: boolean;
  /** Lọc chỉ import các category trong danh sách này. Không truyền = import tất cả. */
  categories?: string[];
}

/**
 * Chạy toàn bộ pipeline import OpenMoji.
 * @returns Thống kê sau khi import hoàn tất.
 */
export async function runImport(options: ImportOptions): Promise<ImportStats> {
  const { projectRoot, dryRun = false, categories } = options;

  // Bước 1: Đọc dữ liệu OpenMoji
  console.log('📖 Reading OpenMoji data...');
  const entries = readOpenMojiData(projectRoot);
  console.log(`   Found ${entries.length} total OpenMoji entries.`);

  // Bước 2: Parse + filter + map category + resolve translation
  console.log('🔍 Parsing and filtering entries...');
  const { assets, skipped } = parseEntries(entries, projectRoot, categories);
  console.log(`   ${assets.length} assets matched${categories ? ` [${categories.join(', ')}]` : ''}.`);
  console.log(`   ${skipped.length} entries skipped (no SVG or unmapped category).`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN — no files written.\n');
    const stats = buildStats(assets, skipped);
    return stats;
  }

  // Bước 3: Đảm bảo thư mục tồn tại
  console.log('📁 Creating asset directories...');
  ensureAssetDirectories(projectRoot);

  // Bước 4: Ghi từng asset (SVG + metadata.json)
  console.log('💾 Writing assets...');
  for (const asset of assets) {
    try {
      writeAsset(asset, projectRoot);
    } catch (err) {
      const msg = `[ERROR] Failed to write asset "${asset.id}": ${(err as Error).message}`;
      console.error(msg);
      skipped.push(msg);
    }
  }

  // Bước 5: Sinh assets/index.json
  console.log('📋 Generating assets/index.json...');
  writeIndex(assets, projectRoot);

  // Bước 6: Sinh content/{category}.json
  console.log('📄 Generating content/*.json files...');
  writeContentFiles(assets, projectRoot);

  // Bước 7: Tính thống kê
  const stats = buildStats(assets, skipped);
  return stats;
}
