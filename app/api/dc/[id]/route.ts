import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse, getSessionInfo } from '@/lib/session';
import { deleteEntry } from '@/lib/services/dc';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await getSessionInfo();
    if (!s) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    await deleteEntry(prisma, s.ctx, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
