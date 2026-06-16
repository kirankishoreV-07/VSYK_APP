# Task: Database Schema Change

## Your Protocol

1. **Inspect current schema** — read the latest migrations in `Frontend/supabase/migrations` and any related types.
2. **Propose the migration** as SQL before writing the file:
   - New tables / columns / indexes / constraints
   - RLS policies (Supabase — never skip this)
   - Backfill strategy for existing rows
   - Rollback plan
3. **Wait for my approval.**
4. **Write the migration file** with a timestamped name matching the existing convention.
5. **Update TypeScript types** wherever the schema is consumed (backend services, frontend hooks, shared types).
6. **Update affected queries** — list every file that touches the changed tables.
7. **Report**: migration filename, files updated, manual steps (e.g., "run `supabase db push`"), and any data risks.

## Constraints
- Never drop a column or table without an explicit rollback plan and my approval.
- Always add RLS policies for new tables — never ship a table open to `anon`.
- Money columns are `numeric(14,2)`, never `float`.