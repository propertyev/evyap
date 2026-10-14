import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse, getSessionInfo } from '@/lib/session';
import { recordInvoice } from '@/lib/services/invoices';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await getSessionInfo();
    if (!s) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    return NextResponse.json(await recordInvoice(prisma, s.ctx, params.id));
  } catch (e) {
    return errorResponse(e);
  }
}
