import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse, getSessionInfo } from '@/lib/session';
import { undoImport } from '@/lib/services/import';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await getSessionInfo();
    if (!s) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    return NextResponse.json(await undoImport(prisma, s.ctx, params.id));
  } catch (e) {
    return errorResponse(e);
  }
}
