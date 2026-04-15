const SESSION_ID_KEY = 'muniweb_session_id';

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSessionId(): string {
  const existing = localStorage.getItem(SESSION_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = createSessionId();
  localStorage.setItem(SESSION_ID_KEY, generated);
  return generated;
}

export function getApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    throw new Error('Missing required environment variable: VITE_API_URL');
  }

  return apiUrl;
}

export function getAuthHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const sessionId = getSessionId();
  const merged: Record<string, string> = {
    'x-session-id': sessionId,
    ...headers
  };

  const savedAdmin = localStorage.getItem('admin');
  if (savedAdmin) {
    try {
      const parsed = JSON.parse(savedAdmin);
      if (parsed?.id) {
        merged['x-admin-id'] = String(parsed.id);
      }
      if (parsed?.level) {
        merged['x-admin-level'] = String(parsed.level);
      }
    } catch {
      // Ignore malformed localStorage admin payload.
    }
  }

  return merged;
}

export function clearSessionId(): void {
  localStorage.removeItem(SESSION_ID_KEY);
}
