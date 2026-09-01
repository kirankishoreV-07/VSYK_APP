export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
    if (!API_BASE_URL) {
        throw new Error('API base URL is not configured.');
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error || 'Request failed.');
    }
    return data as T;
}
