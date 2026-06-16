# Task: Gap Audit

Before we build anything new, produce a complete audit of the current codebase against the spec.

## Steps (do in order, do not skip)

1. List every file under `Backend/src/` and `Frontend/app/` with a one-line purpose.
2. For each of the 8 phases in the spec, mark status: ✅ Done / 🟡 Partial / ❌ Missing.
3. For each 🟡 Partial item, list exactly what's missing.
4. Flag any code that violates a business rule in `CLAUDE.md`.
5. Flag any duplicated logic or dead code.
6. Produce a pr ioritized list of the top 10 things to fix before adding new features.

## Output Format

Return a single markdown report with these sections:
- **File Inventory** (table: path | purpose | last touched if known)
- **Phase Status Matrix** (table: phase | status | what's missing)
- **Business Rule Violations** (list with file:line references)
- **Duplication / Dead Code** (list)
- **Top 10 Fixes — Prioritized** (numbered list with rationale)

## Constraints
- Do NOT write or modify any code in this task.
- Do NOT suggest new features — only audit what exists vs. spec.
- If a file is too large to read fully, read the first 200 lines + grep for key symbols.