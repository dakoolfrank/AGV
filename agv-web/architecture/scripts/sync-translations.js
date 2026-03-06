// Simple translation sync: ensure all locale files contain all keys present in en.json.
// Missing keys will be filled with English values as placeholders.
// Usage:
//   node scripts/sync-translations.js          -> sync and write changes
//   node scripts/sync-translations.js --report -> only report missing key counts, no writes
//   node scripts/sync-translations.js --force  -> force write even if no detected diffs (reformat/standardize)

const fs = require('fs');
const path = require('path');

const messagesDir = path.resolve(__dirname, '..', 'src', 'messages');
const locales = ['en', 'zh-CN', 'zh-TW', 'ko', 'tl', 'fr', 'de', 'es', 'ar', 'ja'];
const argv = process.argv.slice(2);
const isReportOnly = argv.includes('--report');
const isForce = argv.includes('--force');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function countMissing(baseObj, targetObj) {
  if (typeof baseObj !== 'object' || baseObj === null) return 0;
  let missing = 0;
  const t = (typeof targetObj === 'object' && targetObj !== null) ? targetObj : (Array.isArray(baseObj) ? [] : {});
  for (const key of Object.keys(baseObj)) {
    const bv = baseObj[key];
    const tv = t[key];
    if (typeof bv === 'object' && bv !== null && !Array.isArray(bv)) {
      // If target has non-object here, all nested keys are missing
      if (typeof tv !== 'object' || tv === null || Array.isArray(tv)) {
        // rough count: all leaf strings inside bv
        missing += countLeaves(bv);
      } else {
        missing += countMissing(bv, tv);
      }
    } else if (Array.isArray(bv)) {
      if (!Array.isArray(tv)) missing += 1; // treat whole array as one missing unit
    } else {
      if (typeof tv !== 'string') missing += 1;
    }
  }
  return missing;
}

function countLeaves(obj) {
  if (typeof obj !== 'object' || obj === null) return 0;
  let leaves = 0;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'object' && v !== null) {
      leaves += countLeaves(v);
    } else if (!Array.isArray(v)) {
      leaves += 1;
    }
  }
  return leaves;
}

function mergeKeys(baseObj, targetObj) {
  // Recursively copy keys from baseObj to targetObj when missing
  if (typeof baseObj !== 'object' || baseObj === null) return targetObj;
  if (typeof targetObj !== 'object' || targetObj === null) targetObj = Array.isArray(baseObj) ? [] : {};

  for (const key of Object.keys(baseObj)) {
    const baseVal = baseObj[key];
    const targetVal = targetObj[key];

    if (typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal)) {
      // Always merge nested objects, even if targetVal exists
      targetObj[key] = mergeKeys(baseVal, (typeof targetVal === 'object' && targetVal !== null) ? targetVal : {});
    } else if (Array.isArray(baseVal)) {
      // For arrays, if missing, copy the English array as placeholder
      if (!Array.isArray(targetVal)) {
        targetObj[key] = baseVal.slice();
      }
    } else {
      // Primitive: if missing or not a string, set to English
      if (typeof targetVal !== 'string') {
        targetObj[key] = String(baseVal);
      }
    }
  }

  return targetObj;
}

(function main() {
  const enPath = path.join(messagesDir, 'en.json');
  const en = readJson(enPath);
  if (!Object.keys(en).length) {
    console.error('en.json is missing or empty. Aborting.');
    process.exit(1);
  }

  let updatedCount = 0;
  let reportLines = [];

  for (const locale of locales) {
    const filePath = path.join(messagesDir, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      if (isReportOnly) {
        reportLines.push(`${locale}: file missing -> would create from en.json`);
        continue;
      }
      writeJson(filePath, en);
      console.log(`Created ${locale}.json from en.json`);
      updatedCount++;
      continue;
    }
    const current = readJson(filePath);
    const missing = countMissing(en, current);

    if (isReportOnly) {
      reportLines.push(`${locale}: ${missing} missing key(s)`);
      continue;
    }

    const merged = mergeKeys(en, JSON.parse(JSON.stringify(current)));

    // Only write if changed or --force specified
    const before = JSON.stringify(current);
    const after = JSON.stringify(merged);
    if (isForce || before !== after) {
      writeJson(filePath, merged);
      console.log(`Synced ${locale}.json (${missing} missing key(s) filled)`);
      updatedCount++;
    }
  }

  if (isReportOnly) {
    console.log(reportLines.join('\n'));
    return;
  }

  console.log(updatedCount ? `Done. Updated ${updatedCount} file(s).` : 'All locale files already up to date.');
})();

