# Task: Build / Extend a Phase

I will tell you which phase. Follow this exact protocol.

## Step 1 — Recon (no code yet)
1

. Read `CLAUDE.md` to refresh business rules.
2. Read every existing file related to this phase (list them first, then read).
3. Read the latest Supabase migration to confirm current schema.
4. Summarize in 5–10 bullets: what exists, what's missing, what needs changing.
5. **STOP and wait for my "go ahead" before writing any code.**

## Step 2 — Plan
Once I approve the recon, produce:
- A list of files you will create (with path + purpose).
- A list of files you will modify (with path + what changes).
- Any new migration needed (filename + summary of changes).
- Any new dependency (name + why).
- Definition of done — a checklist I can verify.

**STOP and wait for my approval of the plan.**

## Step 3 — Build
Once I approve the plan:
- Implement strictly within the plan. Do not add extra features.
- Write code in small, reviewable chunks. After each file, briefly note what it does.
- If you discover the plan is wrong mid-build, STOP and ask me, do not improvise.

## Step 4 — Verify
After building:
- Run the definition-of-done checklist and report pass/fail for each item.
- List every file touched.
- List manual test steps I should run.
- Flag any TODOs or known gaps left behind.

## Constraints
- Never rewrite working code unless explicitly asked.
- Never skip the recon step "to save time."
- Never bleed into the next phase.