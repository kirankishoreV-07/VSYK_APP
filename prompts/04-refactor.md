# Task: Refactor

## Inputs I'll Provide
- The target (file, module, or pattern).
- The reason (readability, performance, duplication, etc.).
- The boundary (what's in scope, what's out).

## Your Protocol

1. Read the target code fully + every file that imports it.
2. List the public surface (exports, props, API shape) — this must NOT change unless I say so.
3. Propose the refactor as a diff plan (before →

after, with reasoning).
4. Wait for my approval.
5. Execute. Keep commits/changes mentally grouped so I can review in logical chunks.
6. Run/verify nothing broke: list the files touched and the behaviors that should still work identically.

## Constraints
- Public API stays stable unless I explicitly approve a breaking change.
- No mixing refactor with new features or bug fixes.
- If you discover the refactor is bigger than expected, stop and tell me — don't push through.