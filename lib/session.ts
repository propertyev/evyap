import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { authOptions } from './auth';
import { prisma } from './db';
import { AppError } from './errors';
import type { Ctx, Role } from './services/types';

export interface SessionInfo {
  ctx: Ctx;
  user: { id: string; name: string; email: string };
}

export async function getSessionInfo(): Promise<SessionInfo | null> {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id || !s.user.companyId) return null;
  return {
    ctx: { companyId: s.user.companyId, userId: s.user.id, role: s.user.role as Role },
    user: { id: s.user.id, name: s.user.name ?? '', email: s.user.email ?? '' },
  };
}

/** For server components: redirects to /login when signed out. */
export async function requireSession(): Promise<SessionInfo> {
  const s = await getSessionInfo();
  if (!s) redirect('/login');
  return s;
}

/** The financial year the user is looking at (cookie "fy"), defaulting to the latest year. */
export async function selectedYear(companyId: string): Promise<{ year: number; years: number[] }> {
  const fys = await prisma.fiscalYear.findMany({ where: { companyId }, select: { year: true }, orderBy: { year: 'asc' } });
  const years = fys.map((f) => f.year);
  const now = new Date().getFullYear();
  if (!years.length) return { year: now, years: [now] };
  const raw = Number(cookies().get('fy')?.value);
  const year = years.includes(raw) ? raw : years.includes(now) ? now : years[years.length - 1];
  return { year, years };
}

/** Wrap an API handler: auth, JSON errors with proper status codes. */
export function api<T>(fn: (info: SessionInfo, req: Request) => Promise<T>) {
  return async (req: Request): Promise<Response> => {
    try {
      const info = await getSessionInfo();
      if (!info) return NextResponse.json({ error: 'UNAUTHENTICATED', message: 'Please sign in.' }, { status: 401 });
      const out = await fn(info, req);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.code, message: e.message, details: e.details }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: 'VALIDATION', message: e.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ') },
      { status: 422 },
    );
  }
  console.error(e);
  return NextResponse.json({ error: 'SERVER', message: 'Something went wrong.' }, { status: 500 });
}

export async function json<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError('BAD_JSON', 'Invalid request body.', 400);
  }
}
