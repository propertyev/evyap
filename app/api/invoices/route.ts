import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { listInvoices, nextRefNo, saveInvoice, type InvoiceInput } from '@/lib/services/invoices';

export const GET = api(async ({ ctx }, req) => {
  const u = new URL(req.url);
  const type = u.searchParams.get('nextRef');
  if (type === 'INVOICE' || type === 'RECEIPT') {
    const year = Number(u.searchParams.get('year')) || new Date().getFullYear();
    return { refNo: await nextRefNo(prisma, ctx.companyId, type, year) };
  }
  return { rows: await listInvoices(prisma, ctx.companyId) };
});

export const POST = api(async ({ ctx }, req) => ({ id: await saveInvoice(prisma, ctx, await json<InvoiceInput>(req)) }));
