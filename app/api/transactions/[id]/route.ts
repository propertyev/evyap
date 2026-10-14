import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse, getSessionInfo, json } from '@/lib/session';
import { deleteTransaction, updateTransaction, txPatch } from '@/lib/services/ledger';
import type { z } from 'zod';

type P = { params: { id: string } };

export async function PATCH(req: Request, { params }: P) {
  try {
    const s = await getSessionInfo();
    if (!s) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    await updateTransaction(prisma, s.ctx, params.id, await json<z.infer<typeof txPatch>>(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: P) {
  try {
    const s = await getSessionInfo();
    if (!s) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    await deleteTransaction(prisma, s.ctx, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
