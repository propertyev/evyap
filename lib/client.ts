'use client';

export class ApiError extends Error {
  constructor(public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(url: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body || init.form ? 'POST' : 'GET'),
    headers: init.form ? undefined : init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string; details?: unknown };
    throw new ApiError(d.error ?? 'ERROR', d.message ?? `Request failed (${res.status})`, d.details);
  }
  return data as T;
}
