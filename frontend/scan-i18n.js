#!/usr/bin/env node
/**
 * Fixora i18n Scanner
 * Finds all hardcoded text in your React/TSX files that needs translation.
 *
 * Usage: node scan-i18n.js [src_folder]
 * Default: ./src
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CONFIG =====
const SRC_DIR = process.argv[2] || "./src";
const FILE_EXTS = [".tsx", ".jsx"];
const IGNORE_DIRS = ["node_modules", "dist", "build", ".next", "i18n"];

// Words/strings to ignore (technical, single chars, etc.)
const IGNORE_PATTERNS = [
  /^\s*$/,                          // whitespace
  /^[0-9.,$%+\-*/]+$/,              // pure numbers/symbols
  /^[a-z-_]+$/,                     // single CSS class words like "flex"
  /^[A-Z_]+$/,                      // CONSTANTS
  /^https?:\/\//,                   // URLs
  /^\/[a-z-/]+$/i,                  // routes like /login
  /^@/,                             // npm packages
  /^\.\.?\//,                       // file paths
  /^[a-z]+:[a-z]+/i,                // CSS values like "rgb:red"
  /^#[a-fA-F0-9]+$/,                // hex colors
  /^[a-z]+$/i,                      // single technical words (id, key)
];

// Common technical words to filter out
const TECHNICAL_WORDS = new Set([
  "div", "span", "button", "input", "form", "label", "true", "false",
  "null", "undefined", "GET", "POST", "PUT", "DELETE", "JSON", "id",
  "key", "name", "type", "value", "className", "onClick", "onChange",
  "ref", "src", "href", "alt", "px", "rem", "em", "auto", "none",
  "block", "flex", "grid", "absolute", "relative", "fixed", "sticky",
  "hidden", "visible", "primary", "secondary", "success", "error",
  "warning", "info", "default", "small", "medium", "large",
]);

// ===== SCANNERS =====

/**
 * Extract JSX text content like <h1>Hello World</h1>
 */
function extractJSXText(content) {
  const matches = [];
  // Match text between > and < (JSX content)
  const regex = />([^<>{}\n]+)</g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const text = m[1].trim();
    if (isTranslatable(text)) {
      matches.push({
        text,
        type: "JSX text",
        line: getLineNumber(content, m.index),
      });
    }
  }
  return matches;
}

/**
 * Extract string attributes like placeholder="Email", title="Welcome"
 */
function extractAttributes(content) {
  const matches = [];
  // Common user-facing attributes
  const attrs = ["placeholder", "title", "alt", "label", "aria-label"];
  for (const attr of attrs) {
    const regex = new RegExp(`${attr}=["']([^"']+)["']`, "g");
    let m;
    while ((m = regex.exec(content)) !== null) {
      const text = m[1].trim();
      if (isTranslatable(text)) {
        matches.push({
          text,
          type: `${attr} attr`,
          line: getLineNumber(content, m.index),
        });
      }
    }
  }
  return matches;
}

/**
 * Extract toast/alert messages: toast.success("Message")
 */
function extractToasts(content) {
  const matches = [];
  const regex = /(?:toast|alert|message|notify|console\.log|throw new Error)\s*\.?\w*\s*\(\s*["']([^"']+)["']/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const text = m[1].trim();
    if (isTranslatable(text)) {
      matches.push({
        text,
        type: "toast/alert",
        line: getLineNumber(content, m.index),
      });
    }
  }
  return matches;
}

/**
 * Check if a string is translatable (real user-facing text)
 */
function isTranslatable(text) {
  if (!text || text.length < 2) return false;
  if (text.length > 200) return false;

  // Filter out technical patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(text)) return false;
  }

  // Filter out single technical words
  if (TECHNICAL_WORDS.has(text.toLowerCase())) return false;

  // Must contain at least one space OR be a meaningful single word (4+ chars with vowels)
  const hasSpace = /\s/.test(text);
  const hasVowel = /[aeiouAEIOU]/.test(text);
  const hasLetter = /[a-zA-Z]/.test(text);

  if (!hasLetter) return false;
  if (!hasSpace && (text.length < 4 || !hasVowel)) return false;

  // Skip if it's already a translation key like "common.save"
  if (/^[a-z]+\.[a-zA-Z.]+$/.test(text)) return false;

  return true;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split("\n").length;
}

// ===== FILE WALKING =====

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Directory not found: ${dir}`);
    process.exit(1);
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (!IGNORE_DIRS.includes(item.name)) {
        walk(fullPath, results);
      }
    } else if (FILE_EXTS.some((ext) => item.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// ===== MAIN =====

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");

  // Skip files that already use t() heavily (already translated)
  const tCallCount = (content.match(/\bt\(["']/g) || []).length;
  const totalLines = content.split("\n").length;
  const isMostlyTranslated = tCallCount > totalLines / 20; // rough heuristic

  const findings = [
    ...extractJSXText(content),
    ...extractAttributes(content),
    ...extractToasts(content),
  ];

  return {
    file: filePath,
    tCallCount,
    isMostlyTranslated,
    findings,
  };
}

function main() {
  console.log("\n🔍 Fixora i18n Scanner\n");
  console.log(`Scanning: ${path.resolve(SRC_DIR)}\n`);

  const files = walk(SRC_DIR);
  console.log(`Found ${files.length} TSX/JSX files\n`);

  const results = files.map(scanFile);
  const allFindings = [];

  // Sort by file with most untranslated text first
  const sorted = results
    .filter((r) => r.findings.length > 0)
    .sort((a, b) => b.findings.length - a.findings.length);

  // ===== TEXT REPORT =====
  console.log("=".repeat(70));
  console.log("📋 FILES WITH HARDCODED TEXT (sorted by count)");
  console.log("=".repeat(70));

  for (const r of sorted) {
    const rel = path.relative(process.cwd(), r.file);
    const status = r.isMostlyTranslated ? "🟡 partially translated" : "🔴 not translated";
    console.log(`\n${status} ${rel}`);
    console.log(`   ${r.findings.length} hardcoded strings (${r.tCallCount} t() calls)`);

    // Show top 5 examples
    const examples = r.findings.slice(0, 5);
    for (const f of examples) {
      console.log(`   line ${f.line}: [${f.type}] "${f.text}"`);
    }
    if (r.findings.length > 5) {
      console.log(`   ... and ${r.findings.length - 5} more`);
    }

    // Add to global list
    for (const f of r.findings) {
      allFindings.push({ file: rel, ...f });
    }
  }

  // ===== JSON REPORT =====
  const reportPath = "i18n-report.json";
  fs.writeFileSync(reportPath, JSON.stringify(allFindings, null, 2));

  // ===== SUGGESTED TRANSLATIONS =====
  const suggestions = generateSuggestions(allFindings);
  fs.writeFileSync("i18n-suggestions.json", JSON.stringify(suggestions, null, 2));

  // ===== SUMMARY =====
  console.log("\n" + "=".repeat(70));
  console.log("📊 SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total files scanned:        ${files.length}`);
  console.log(`Files needing translation:  ${sorted.length}`);
  console.log(`Total hardcoded strings:    ${allFindings.length}`);
  console.log(`Unique strings:             ${Object.keys(suggestions).length}`);
  console.log("\n📁 Reports saved:");
  console.log(`   • i18n-report.json        — full list with file + line`);
  console.log(`   • i18n-suggestions.json   — suggested translation keys`);
  console.log("\n💡 Next: Open i18n-suggestions.json to see suggested keys.");
  console.log("   Then add them to src/i18n/locales/en.json and translate.\n");
}

/**
 * Group similar strings and suggest translation keys
 */
function generateSuggestions(findings) {
  const suggestions = {};
  const seen = new Set();

  for (const f of findings) {
    if (seen.has(f.text)) continue;
    seen.add(f.text);

    const key = generateKey(f.text, f.file);
    suggestions[f.text] = {
      suggestedKey: key,
      foundIn: [{ file: f.file, line: f.line, type: f.type }],
    };
  }

  // Add other locations for duplicates
  for (const f of findings) {
    if (suggestions[f.text]) {
      const locations = suggestions[f.text].foundIn;
      const exists = locations.some((l) => l.file === f.file && l.line === f.line);
      if (!exists) {
        locations.push({ file: f.file, line: f.line, type: f.type });
      }
    }
  }

  return suggestions;
}

function generateKey(text, file) {
  // Use file context for the namespace
  const fileName = path.basename(file, path.extname(file)).toLowerCase();
  let namespace = "common";

  if (fileName.includes("login") || fileName.includes("signup") || fileName.includes("auth")) {
    namespace = "auth";
  } else if (fileName.includes("dashboard")) {
    namespace = "dashboard";
  } else if (fileName.includes("booking")) {
    namespace = "booking";
  } else if (fileName.includes("service")) {
    namespace = "services";
  } else if (fileName.includes("layout") || fileName.includes("nav") || fileName.includes("header")) {
    namespace = "nav";
  }

  // Make a snake_case key from the text
  const keyPart = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");

  return `${namespace}.${keyPart || "text"}`;
}

main();
