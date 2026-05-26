// apiFetch — client-side mirror of functions/_lib/http.ts. On a non-2xx
// response it reads the server's { error } envelope and throws an ApiError
// carrying that message, so callers surface the real reason
// ("no updatable fields", "invalid id") instead of a bare "HTTP 400".

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const r = await fetch(input, init);
  if (r.ok) return r;
  let message = `HTTP ${r.status}`;
  try {
    const body = (await r.clone().json()) as { error?: unknown };
    if (typeof body?.error === 'string' && body.error) message = body.error;
  } catch {
    /* non-JSON error body — keep the HTTP status message */
  }
  throw new ApiError(message, r.status);
}
