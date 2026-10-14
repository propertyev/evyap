import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { renderInvoice } from '@/lib/pdf/pack';
import { getInvoice } from '@/lib/services/invoices';
import { errorResponse, getSessionInfo } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await getSessionInfo();
    if (!s) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    const [company, invoice] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: s.ctx.companyId } }),
      getInvoice(prisma, s.ctx.companyId, params.id),
    ]);
    if (!invoice) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const buf = await renderInvoice({ company, invoice });
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.refNo}.pdf"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
