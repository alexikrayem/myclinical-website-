
---

# 📁 6. `scripts/check_hls_leaks.md`

```markdown
# Script: HLS Memory Leak Checker

## Purpose

Detect common mistakes in React + HLS integrations.

⚠️ This is a heuristic tool (not 100% accurate)

---

## Checks

- HLS instance destroyed
- Plyr instance destroyed
- Event listeners cleaned up

---

## Limitations

- Uses string matching (not AST)
- Can produce false positives

---

## Future Improvement

Use AST parsing with:
- @babel/parser
- eslint custom rule

---

## Usage

```bash
node scripts/check_hls_leaks.js path/to/component.tsx