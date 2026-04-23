// scripts/check_hls_leaks.js
const fs = require('fs');

const targetFile = process.argv[2];

if (!targetFile || !fs.existsSync(targetFile)) {
  console.error("❌ Error: Please provide a valid React component file path.");
  process.exit(1);
}

const content = fs.readFileSync(targetFile, 'utf8');
let errors =[];

// Check 1: Is HLS.js being destroyed?
if (content.includes('new Hls(') && !content.includes('.destroy()')) {
  errors.push("- HLS instance is created but `.destroy()` is never called in the useEffect cleanup.");
}

// Check 2: Is Plyr being destroyed?
if (content.includes('new Plyr(') && !content.match(/player.*\.destroy\(\)/)) {
  errors.push("- Plyr instance is created but `.destroy()` is never called in the useEffect cleanup.");
}

// Check 3: Are event listeners cleaned up?
if (content.includes('addEventListener(\'timeupdate\'') && !content.includes('removeEventListener(\'timeupdate\'')) {
  errors.push("- `timeupdate` event listener is added but never removed in the useEffect cleanup.");
}

if (errors.length > 0) {
  console.error("🚨 Memory Leak Validation Failed!");
  console.error("Your React component has the following issues that will cause memory leaks or zombie audio:");
  errors.forEach(e => console.error(e));
  console.error("\nPlease fix these issues before proceeding.");
  process.exit(1);
}

console.log("✅ Memory Leak Validation Passed: All instances and listeners appear to be properly cleaned up.");
process.exit(0);