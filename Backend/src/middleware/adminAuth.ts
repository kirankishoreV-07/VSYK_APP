// ============================================================
// Admin auth middleware — shared by server.ts admin routes and the
// WhatsApp delivery-status endpoint.
// ============================================================
// Verifies the caller's Supabase Auth JWT resolves to a real row in
// admin_users (same check RLS's is_admin() uses). Falls back to the static
// ADMIN_API_SECRET header only when no session is present (non-interactive
// callers) — a real admin session is the primary, preferred path.
// ============================================================

import { Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  _admin = createClient(url, key);
  return _admin;
}

export async function requireAdminAuth(req: Request, res: Response, next: () => void) {
  const secretExpected = process.env.ADMIN_API_SECRET || '';
  const secretProvided = req.header('x-admin-secret') || '';
  if (secretExpected && secretProvided === secretExpected) return next();

  const admin = getAdmin();
  if (!admin) return res.status(401).json({ error: 'Unauthorized.' });

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Unauthorized.' });

  const { data: adminRow } = await admin
    .from('admin_users')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!adminRow) return res.status(401).json({ error: 'Unauthorized.' });

  next();
}
