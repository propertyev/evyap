// Invoice | Receipt documents and recording into the books.
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { audit } from '../audit';
import { AppError } from '../errors';
import { assertCan } from '../permissions';
import { assertYearsUnlocked, getOrCreateFiscalYear } from './years';
import { big, num, type Ctx, type Db } from './types';

export const invoiceInput = z.object({
  id: z.string().optional(),
  type: z.enum(['INVOICE', 'RECEIPT']),
  refNo: z.string().trim().max(40).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attention: z.string().max(200).default(''),
  company: z.string().max(200).default(''),
  address: z.string().max(500).default(''),
  phone: z.string().max(60).default(''),
  email: z.string().max(200).default(''),
  salesType: z.string().max(100).default(''),
  salesPerson: z.string().max(100).default(''),
  discount: z.number().int().min(0).default(0),
  tax: z.number().int().min(0).default(0),
  lines: z.array(z.object({
    description: z.string().max(500).default(''),
    price: z.number().int().min(0),
    qty: z.number().min(0),
  })).min(1).max(100),
});
export type InvoiceInput = z.input<typeof invoiceInput>;

export const lineTotal = (price: number, qty: number) => Math.round(price * qty);
export function invoiceTotals(lines: { price: number; qty: number }[], discount: number, tax: number) {
  const subtotal = lines.reduce((a, l) => a + lineTotal(l.price, l.qty), 0);
  return { subtotal, total: subtotal - discount + tax };
}

export async function nextRefNo(db: Db, companyId: string, type: 'INVOICE' | 'RECEIPT', year: number): Promise<string> {
  const prefix = `${type === 'INVOICE' ? 'INV' : 'RC'}-${year}-`;
  const last = await db.invoice.findMany({
    where: { companyId, refNo: { startsWith: prefix } }, select: { refNo: true }, orderBy: { refNo: 'desc' }, take: 1,
  });
  const n = last.length ? parseInt(last[0].refNo.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

export interface InvoiceView {
  id: string;
  type: 'INVOICE' | 'RECEIPT';
  refNo: string;
  date: string;
  attention: string;
  company: string;
  address: string;
  phone: string;
  email: string;
  salesType: string;
  salesPerson: string;
  discount: number;
  tax: number;
  total: number;
  recorded: boolean;
  lines: { description: string; price: number; qty: number }[];
}

function view(i: Awaited<ReturnType<PrismaClient['invoice']['findFirst']>> & { lines: { description: string; price: bigint; qty: number; position: number }[] }): InvoiceView {
  return {
    id: i!.id, type: i!.type as 'INVOICE' | 'RECEIPT', refNo: i!.refNo, date: i!.date, attention: i!.attention,
    company: i!.company, address: i!.address, phone: i!.phone, email: i!.email, salesType: i!.salesType,
    salesPerson: i!.salesPerson, discount: num(i!.discount), tax: num(i!.tax), total: num(i!.total), recorded: i!.recorded,
    lines: [...i!.lines].sort((a, b) => a.position - b.position).map((l) => ({
      description: l.description, price: num(l.price), qty: l.qty,
    })),
  };
}

export async function listInvoices(db: Db, companyId: string): Promise<InvoiceView[]> {
  const rows = await db.invoice.findMany({
    where: { companyId }, include: { lines: true }, orderBy: [{ date: 'desc' }, { refNo: 'desc' }],
  });
  return rows.map((r) => view(r as never));
}

export async function getInvoice(db: Db, companyId: string, id: string): Promise<InvoiceView | null> {
  const r = await db.invoice.findFirst({ where: { id, companyId }, include: { lines: true } });
  return r ? view(r as never) : null;
}

export async function saveInvoice(prisma: PrismaClient, ctx: Ctx, raw: InvoiceInput): Promise<string> {
  assertCan(ctx.role, 'entry:create');
  const input = invoiceInput.parse(raw);
  const year = +input.date.slice(0, 4);
  return prisma.$transaction(async (tx) => {
    await assertYearsUnlocked(tx, ctx.companyId, [year]);
    const { total } = invoiceTotals(input.lines, input.discount, input.tax);
    const refNo = input.refNo || (await nextRefNo(tx, ctx.companyId, input.type, year));
    const data = {
      type: input.type, refNo, date: input.date, attention: input.attention, company: input.company,
      address: input.address, phone: input.phone, email: input.email, salesType: input.salesType,
      salesPerson: input.salesPerson, discount: big(input.discount), tax: big(input.tax), total: big(total),
    };
    if (input.id) {
      const cur = await tx.invoice.findFirst({ where: { id: input.id, companyId: ctx.companyId } });
      if (!cur) throw new AppError('NOT_FOUND', 'Document not found', 404);
      if (cur.recorded) throw new AppError('RECORDED', 'A recorded document cannot be edited.', 409);
      await tx.invoiceLine.deleteMany({ where: { invoiceId: cur.id } });
      await tx.invoice.update({
        where: { id: cur.id },
        data: {
          ...data,
          lines: { create: input.lines.map((l, i) => ({ description: l.description, price: big(l.price), qty: l.qty, position: i })) },
        },
      });
      await audit(tx, ctx, 'INVOICE_UPDATE', 'Invoice', cur.id, { refNo: cur.refNo, total: cur.total }, { refNo, total });
      return cur.id;
    }
    const dup = await tx.invoice.findUnique({ where: { companyId_refNo: { companyId: ctx.companyId, refNo } } });
    if (dup) throw new AppError('DUPLICATE_REF', `Reference ${refNo} already exists.`, 409);
    const row = await tx.invoice.create({
      data: {
        companyId: ctx.companyId, ...data,
        lines: { create: input.lines.map((l, i) => ({ description: l.description, price: big(l.price), qty: l.qty, position: i })) },
      },
    });
    await audit(tx, ctx, 'INVOICE_CREATE', 'Invoice', row.id, null, { refNo, total });
    return row.id;
  });
}

/** INVOICE -> Debtor entry (credit sale). RECEIPT -> Cash In / Sales. Never twice. */
export async function recordInvoice(prisma: PrismaClient, ctx: Ctx, id: string) {
  assertCan(ctx.role, 'entry:create');
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!inv) throw new AppError('NOT_FOUND', 'Document not found', 404);
    if (inv.recorded) throw new AppError('RECORDED', 'This document was already recorded.', 409);
    const total = num(inv.total);
    if (total <= 0) throw new AppError('NO_AMOUNT', 'Nothing to record: the total is zero.', 422);
    const year = +inv.date.slice(0, 4);
    await assertYearsUnlocked(tx, ctx.companyId, [year]);
    await getOrCreateFiscalYear(tx, ctx.companyId, year);
    const who = inv.company || inv.attention || 'Customer';
    // optimistic guard against double submit
    const claim = await tx.invoice.updateMany({ where: { id, recorded: false }, data: { recorded: true } });
    if (claim.count === 0) throw new AppError('RECORDED', 'This document was already recorded.', 409);

    if (inv.type === 'INVOICE') {
      const e = await tx.debtorCreditor.create({
        data: {
          companyId: ctx.companyId, date: inv.date, year, type: 'DEBTOR', partyName: who,
          details: inv.refNo, amount: big(total), invoiceId: inv.id,
        },
      });
      await audit(tx, ctx, 'INVOICE_RECORD', 'Invoice', id, null, { as: 'DEBTOR', entry: e.id, total });
      return { as: 'DEBTOR' as const };
    }
    const sales = await tx.category.findUnique({ where: { companyId_name: { companyId: ctx.companyId, name: 'Sales' } } });
    if (!sales) throw new AppError('BAD_CATEGORY', 'Sales category missing', 500);
    const t = await tx.transaction.create({
      data: {
        companyId: ctx.companyId, date: inv.date, year, direction: 'IN', categoryId: sales.id,
        details: `${inv.refNo} ${who}`.trim(), amount: big(total), source: 'RECEIPT',
        hash: `receipt:${inv.id}:${randomUUID()}`, createdBy: ctx.userId,
      },
    });
    await audit(tx, ctx, 'INVOICE_RECORD', 'Invoice', id, null, { as: 'CASH_IN_SALES', transaction: t.id, total });
    return { as: 'CASH_IN_SALES' as const };
  });
}

export async function deleteInvoice(prisma: PrismaClient, ctx: Ctx, id: string) {
  assertCan(ctx.role, 'entry:delete');
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!inv) throw new AppError('NOT_FOUND', 'Document not found', 404);
    await assertYearsUnlocked(tx, ctx.companyId, [+inv.date.slice(0, 4)]);
    await tx.debtorCreditor.deleteMany({ where: { invoiceId: id, companyId: ctx.companyId } });
    await tx.transaction.deleteMany({
      where: { companyId: ctx.companyId, source: 'RECEIPT', hash: { startsWith: `receipt:${id}:` } },
    });
    await tx.invoice.delete({ where: { id } });
    await audit(tx, ctx, 'INVOICE_DELETE', 'Invoice', id, { refNo: inv.refNo, total: inv.total }, null);
  });
}
