#!/usr/bin/env node
/**
 * Fixora Auto-Translator (v2 — SAFE)
 *
 * Fixed bugs:
 *   - skips strings with code-like syntax (===, &&, =>, etc.)
 *   - skips text inside arrow functions / comparisons
 *   - only patches text that's clearly user-facing
 *   - won't insert imports if file already has incomplete imports
 *
 * Usage:
 *   node auto-translate.js --dry-run          # preview
 *   node auto-translate.js --only=Layout.tsx  # one file
 *   node auto-translate.js                    # full run
 */

import fs from "fs";
import path from "path";
import https from "https";

const SRC_DIR = "./src";
const LOCALES_DIR = "./src/i18n/locales";
const SUGGESTIONS_FILE = "./i18n-suggestions.json";
const TARGET_LANGS = ["es", "hi", "gu"];

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const NO_PATCH = args.includes("--no-patch");
const ONLY_FILE = args.find((a) => a.startsWith("--only="))?.split("=")[1];

// ===== TEXT FILTERS =====
// Skip strings that look like code, not user-facing text

const CODE_PATTERNS = [
  /^[=<>!]/,                       // starts with operator: "= start", "<= maxPrice"
  /[=<>!]=?$/,                     // ends with operator
  /===|!==|&&|\|\||=>/,             // contains JS operators
  /^\(.*\)\s*[:=]/,                // function-like: "(path: string):"
  /^[a-z_]+\s*:\s*$/i,             // "category_id:" alone
  /\.[a-z]+\s*\(/i,                // method calls
  /^&\s/,                           // "& VariantProps"
  /^\d+\s*&&/,                     // "0 && value.length"
  /^[a-z]+\.[a-zA-Z.]+$/,           // already a translation key
];

function isCodeLike(text) {
  return CODE_PATTERNS.some((p) => p.test(text.trim()));
}

// ===== LOAD =====

function loadJSON(filePath, defaultValue = {}) {
  if (!fs.existsSync(filePath)) return defaultValue;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveJSON(filePath, data) {
  if (DRY_RUN) {
    console.log(`   [dry-run] would save ${filePath}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

// ===== GOOGLE TRANSLATE =====

function translateOne(text, targetLang, sourceLang = "en") {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      client: "gtx",
      sl: sourceLang,
      tl: targetLang,
      dt: "t",
      q: text,
    });
    const url = `https://translate.googleapis.com/translate_a/single?${params}`;

    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            const translated = data[0].map((p) => p[0]).filter(Boolean).join("");
            resolve(translated || text);
          } catch {
            resolve(text);
          }
        });
      })
      .on("error", () => resolve(text));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateAll(suggestions) {
  console.log(`\n🌍 Translating to ${TARGET_LANGS.join(", ")}...\n`);

  const translations = { en: {}, es: {}, hi: {}, gu: {} };
  let count = 0;
  const total = Object.keys(suggestions).length;

  for (const [text, info] of Object.entries(suggestions)) {
    count++;
    const key = info.suggestedKey;
    translations.en[key] = text;

    process.stdout.write(`   [${count}/${total}] "${text.slice(0, 50)}"`);

    for (const lang of TARGET_LANGS) {
      const translated = await translateOne(text, lang);
      translations[lang][key] = translated;
      await sleep(150);
    }
    process.stdout.write("  ✓\n");
  }
  return translations;
}

// ===== NESTED KEY HELPERS =====

function setNested(obj, dotKey, value) {
  const parts = dotKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function mergeIntoLocale(localePath, flatTranslations) {
  const existing = loadJSON(localePath, {});
  for (const [key, val] of Object.entries(flatTranslations)) {
    setNested(existing, key, val);
  }
  saveJSON(localePath, existing);
}

// ===== TSX PATCHER (v2 — SAFE) =====

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn(`   ⚠️  not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;
  let patchCount = 0;

  for (const { text, key, type } of replacements) {
    if (isCodeLike(text)) continue; // SAFETY: skip code-like text

    const escaped = escapeForRegex(text);

    if (type === "JSX text") {
      // Match >TEXT< only when surrounded by clean JSX boundaries
      // Require non-code char before > and after <
      const re = new RegExp(`(>)\\s*${escaped}\\s*(<\\/?[a-zA-Z])`, "g");
      const before = content;
      content = content.replace(re, `$1{t("${key}")}$2`);
      if (content !== before) patchCount++;
    } else if (type.includes("attr")) {
      const attrName = type.split(" ")[0];
      const re = new RegExp(`${attrName}=["']${escaped}["']`, "g");
      const before = content;
      content = content.replace(re, `${attrName}={t("${key}")}`);
      if (content !== before) patchCount++;
    } else if (type === "toast/alert") {
      const re = new RegExp(`(["'])${escaped}\\1`, "g");
      const before = content;
      content = content.replace(re, `t("${key}")`);
      if (content !== before) patchCount++;
    }
  }

  // Add useTranslation import + hook only if patches succeeded
  if (patchCount > 0 && content !== original) {
    if (!/from\s+["']react-i18next["']/.test(content)) {
      // Find the END of the last complete import statement (handles multi-line)
      const importRegex = /^import\s+[\s\S]+?from\s+["'][^"']+["'];?\s*$/gm;
      let lastMatch = null;
      let m;
      while ((m = importRegex.exec(content)) !== null) {
        lastMatch = m;
      }
      if (lastMatch) {
        const insertPos = lastMatch.index + lastMatch[0].length;
        content =
          content.slice(0, insertPos) +
          `\nimport { useTranslation } from "react-i18next";` +
          content.slice(insertPos);
      } else {
        content = `import { useTranslation } from "react-i18next";\n` + content;
      }
    }

    if (!/const\s*\{\s*t\s*\}\s*=\s*useTranslation\(\)/.test(content)) {
      const funcMatch = content.match(
        /(export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{|export\s+(?:default\s+)?const\s+\w+\s*[:=][^{]*=>\s*\{|function\s+\w+\s*\([^)]*\)\s*\{)/,
      );
      if (funcMatch) {
        const insertPos = funcMatch.index + funcMatch[0].length;
        content =
          content.slice(0, insertPos) +
          `\n  const { t } = useTranslation();\n` +
          content.slice(insertPos);
      }
    }
  }

  if (content === original) return false;

  if (DRY_RUN) {
    console.log(`   [dry-run] would patch ${filePath} (${patchCount})`);
    return true;
  }

  fs.writeFileSync(filePath, content);
  console.log(`   ✓ patched ${filePath} (${patchCount})`);
  return true;
}

// ===== MAIN =====

async function main() {
  console.log("\n🤖 Fixora Auto-Translator v2\n");
  if (DRY_RUN) console.log("⚠️  DRY RUN\n");

  if (!fs.existsSync(SUGGESTIONS_FILE)) {
    console.error(`❌ ${SUGGESTIONS_FILE} not found. Run scan-i18n.js first.\n`);
    process.exit(1);
  }

  const suggestionsRaw = loadJSON(SUGGESTIONS_FILE);

  // Filter out code-like strings BEFORE translation
  const suggestions = {};
  let skipped = 0;
  for (const [text, info] of Object.entries(suggestionsRaw)) {
    if (isCodeLike(text)) {
      skipped++;
      continue;
    }
    suggestions[text] = info;
  }

  const total = Object.keys(suggestions).length;
  console.log(`📥 ${total} translatable strings (${skipped} code-like skipped)`);

  if (total === 0) {
    console.log("✅ Nothing to translate.\n");
    return;
  }

  const translations = await translateAll(suggestions);

  console.log("\n📝 Updating locale files...");
  for (const lang of ["en", ...TARGET_LANGS]) {
    const localePath = path.join(LOCALES_DIR, `${lang}.json`);
    mergeIntoLocale(localePath, translations[lang]);
    console.log(`   ${DRY_RUN ? "[dry-run]" : "✓"} ${localePath}`);
  }

  if (NO_PATCH) {
    console.log("\n⏭️  Skipping file patches.");
  } else {
    console.log("\n🔧 Patching source files...");

    const byFile = {};
    for (const [text, info] of Object.entries(suggestions)) {
      for (const loc of info.foundIn) {
        if (ONLY_FILE && !loc.file.includes(ONLY_FILE)) continue;
        if (!byFile[loc.file]) byFile[loc.file] = [];
        byFile[loc.file].push({ text, key: info.suggestedKey, type: loc.type });
      }
    }

    let patched = 0;
    for (const [file, reps] of Object.entries(byFile)) {
      if (patchFile(file, reps)) patched++;
    }
    console.log(`\n✅ Patched ${patched} files.`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`📊 Done. ${total} strings translated. ${skipped} skipped (code-like).`);
  console.log("=".repeat(60));
  console.log("\n💡 Next: npm run dev → click 🌐 → switch language\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
