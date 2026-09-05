import { supabase } from './supabase';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

const REQUEST_TIMEOUT_MS = 15_000;

async function postJson<T>(
    path: string,
    payload: unknown,
    headers: Record<string, string>,
): Promise<T> {
    if (!API_BASE_URL) {
        throw new Error('API base URL is not configured.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload ?? {}),
            signal: controller.signal,
        });
    } catch (error: any) {
        const developmentTarget = __DEV__ ? ` (${API_BASE_URL})` : '';
        if (error?.name === 'AbortError') {
            throw new Error(`The VSYK server took too long to respond${developmentTarget}.`);
        }
        throw new Error(
            `Cannot reach the VSYK server${developmentTarget}. ` +
            'Make sure the backend is running and this device is on the same network.',
        );
    } finally {
        clearTimeout(timeout);
    }

    const responseText = await response.text();
    let data: any = {};
    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            if (!response.ok) {
                throw new Error(`Server returned HTTP ${response.status}.`);
            }
            throw new Error('Server returned an invalid response.');
        }
    }

    if (!response.ok) {
        throw new Error(data?.error || `Request failed with HTTP ${response.status}.`);
    }
    return data as T;
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
    return postJson<T>(path, payload, { 'Content-Type': 'application/json' });
}

/**
 * POST to an admin-only backend route with the current admin's real
 * Supabase Auth session attached as a Bearer token — the backend verifies
 * this JWT belongs to a row in admin_users (same check RLS uses) before
 * running the request. Admin credentials must never be embedded in the app.
 */
export async function apiPostAdmin<T>(path: string, payload: unknown): Promise<T> {
    if (!API_BASE_URL) {
        throw new Error('API base URL is not configured.');
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
        throw new Error('Your admin session has expired. Please log in again.');
    }

    return postJson<T>(path, payload, {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    });
}

async function adminRequest<T>(method: 'GET' | 'DELETE', path: string, payload?: unknown): Promise<T> {
    if (!API_BASE_URL) {
        throw new Error('API base URL is not configured.');
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
        throw new Error('Your admin session has expired. Please log in again.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: payload === undefined ? undefined : JSON.stringify(payload),
            signal: controller.signal,
        });
    } catch (error: any) {
        const developmentTarget = __DEV__ ? ` (${API_BASE_URL})` : '';
        if (error?.name === 'AbortError') {
            throw new Error(`The VSYK server took too long to respond${developmentTarget}. Refresh before trying again.`);
        }
        throw new Error(
            `Cannot reach the VSYK server${developmentTarget}. ` +
            'Make sure the backend is running and this device is on the same network.',
        );
    } finally {
        clearTimeout(timeout);
    }

    const responseText = await response.text();
    let data: any = {};
    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            throw new Error(response.ok ? 'Server returned an invalid response.' : `Server returned HTTP ${response.status}.`);
        }
    }
    if (!response.ok) throw new Error(data?.error || `Request failed with HTTP ${response.status}.`);
    return data as T;
}

export function apiGetAdmin<T>(path: string): Promise<T> {
    return adminRequest<T>('GET', path);
}

export function apiDeleteAdmin<T>(path: string, payload: unknown): Promise<T> {
    return adminRequest<T>('DELETE', path, payload);
}

/**
 * POST with the current authenticated Supabase session attached as a Bearer
 * token. Required for server-authoritative endpoints (payments) that resolve
 * the caller's identity from the JWT rather than trusting client-sent ids.
 */
export async function apiPostAuthed<T>(path: string, payload: unknown): Promise<T> {
    if (!API_BASE_URL) {
        throw new Error('API base URL is not configured.');
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
        throw new Error('Your session has expired. Please log in again.');
    }

    return postJson<T>(path, payload, {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    });
}
