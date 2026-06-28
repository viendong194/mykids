/**
 * tools/openmoji/cli.ts
 * CLI entry point cho lệnh `npm run sync-assets`.
 * Parse args, in banner, chạy import, hiển thị thống kê.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runImport } from './importer.js';
import type { ImportStats } from './types.js';

// Resolve project root — compiled output nằm tại dist-tools/tools/openmoji/cli.js
// nên cần đi lên 3 cấp để ra project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Đọc CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');
const showHelp = args.includes('--help') || args.includes('-h');

/**
 * Đọc giá trị của flag --category (có thể truyền nhiều lần hoặc dùng dấu phẩy).
 * Ví dụ: --category animals --category fruits
 * Ví dụ: --category animals,fruits
 * Trả về mảng rỗng nếu không có flag (= import tất cả category).
 */
function parseCategoryFilter(): string[] {
  const categories: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' || args[i] === '-c') {
      const val = args[i + 1];
      if (val && !val.startsWith('-')) {
        val.split(',').forEach(c => categories.push(c.trim().toLowerCase()));
        i++;
      }
    } else if (args[i].startsWith('--category=')) {
      const val = args[i].slice('--category='.length);
      val.split(',').forEach(c => categories.push(c.trim().toLowerCase()));
    }
  }
  return categories;
}

const categoryFilter = parseCategoryFilter();

/** In banner khởi động */
function printBanner(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║    🎨 OpenMoji Asset Importer v1.0       ║');
  console.log('║    Toddler World — Internal Tool         ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
}

/** In hướng dẫn sử dụng */
function printHelp(): void {
  console.log('Usage:');
  console.log('  npm run sync-assets                           Import all categories');
  console.log('  npm run sync-assets -- --category animals     Import only animals');
  console.log('  npm run sync-assets -- -c animals,fruits      Import animals + fruits');
  console.log('  npm run sync-assets -- --dry-run              Preview, no files written');
  console.log('  npm run sync-assets -- --help                 Show this help');
  console.log('');
  console.log('Supported categories:');
  console.log('  animals, fruits, vegetables, foods, vehicles,');
  console.log('  weather, nature, body, clothes, toys, school, sports, music, emoji');
  console.log('');
  console.log('Prerequisites:');
  console.log('  Clone OpenMoji into: external/openmoji/');
  console.log('  git clone https://github.com/hfg-gmuend/openmoji.git external/openmoji');
  console.log('');
}

/** Hiển thị bảng thống kê sau khi import */
function printStats(stats: ImportStats): void {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  ✅ Import Complete — Statistics');
  console.log('═══════════════════════════════════════════');
  console.log('');

  const categories = Object.entries(stats.byCategory)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const maxLabel = Math.max(...categories.map(([cat]) => cat.length));

  console.log('  Imported');
  for (const [cat, count] of categories) {
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    const padding = ' '.repeat(maxLabel - cat.length + 2);
    console.log(`  ${label}:${padding}${count}`);
  }

  console.log('');
  console.log(`  Total:    ${stats.total}`);
  console.log(`  Errors:   ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('');
    console.log('  ⚠️  Warnings / Errors:');
    for (const err of stats.errors) {
      console.log(`     ${err}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('');
}

/** Main entry point */
async function main(): Promise<void> {
  printBanner();

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN mode — no files will be written.\n');
  }

  if (categoryFilter.length > 0) {
    console.log(`🎯 Category filter: ${categoryFilter.join(', ')}\n`);
  }

  try {
    const stats: ImportStats = await runImport({
      projectRoot: PROJECT_ROOT,
      dryRun: isDryRun,
      categories: categoryFilter.length > 0 ? categoryFilter : undefined,
    });

    printStats(stats);

    // Exit code non-zero nếu có lỗi
    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (err) {
    console.error('');
    console.error('❌ Import failed with fatal error:');
    console.error((err as Error).message);
    console.error('');
    process.exit(1);
  }
}

main();
