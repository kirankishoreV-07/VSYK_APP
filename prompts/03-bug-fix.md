# Task: Bug Fix

## What I'll Give You
- A description of the bug (symptom, where I saw it, what I expected).
- Optionally: a stack trace, screenshot, or log.

## Your Protocol

1. **Reproduce in your head first.** Trace the code path from the user action to the failure point. List the files involved.
2. **Identify root cause** — not just the symptom. Explain it in 2–3 sentences.
3. **Propose the fix** before writing it. Include:
   - Files to change
   - Whether it needs a migration
   - Risk of regression elsewhere
4. **Wait for my approval** unless the fix is a one-line obvious typo.
5. **Implement** the minimum change needed. Resist refactoring nearby code.
6. **Report** what you changed and what to test.

## Constraints
- Do not "improve" unrelated code while you're in the file.
- If the bug reveals a deeper design issue, flag it separately — don't fix it in the same pass.