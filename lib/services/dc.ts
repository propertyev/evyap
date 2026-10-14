// Debtor & Creditor register.
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { audit } from '../audit';
import { AppError } from '../errors';
import { assertCan } from '../permissions';
import { assertYearsUnlocked, getOrCreateFiscalYear } from './years';
import { big, num, type Ctx, type Db } from './types';

export interface DCRow {
  id: string;
  date: string;
  type: 'DEBTOR' | 'CREDITOR';
  partyName: string;
  details: string;
  amount: number;
  invoiceId: string | null;
}

export async function listEntries(db: Db, companyId: string, year: number, month?: number): Promise<DCRow[]> {
  const prefix = month === undefined ? `${year}-` : `${year}-${String(month + 1).padStart(2, '0')}-`;
  const rows = await db.debtorCreditor.findMany({
    where: { companyId, year, date: { startsWith: prefix } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id, date: r.date, type: r.type as 'DEBTOR' | 'CREDITOR', partyName: r.partyName,
    details: r.details, amount: num(r.amount), invoiceId: r.invoiceId,
  }));
}

export const dcInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['DEBTOR', 'CREDITOR']),
  partyName: z.string().trim().min(1, 'Name is required').max(200),
  details: z.string().max(500).default(''),
  amount: z.number().int().positive('Amount must be greater than zero'),
});

export async function createEntry(prisma: PrismaClient, ctx: Ctx, raw: z.input<typeof dcInput>, invoiceId?: string) {
  assertCan(ctx.role, 'entry:create');
  const input = dcInput.parse(raw);
  const year = +input.date.slice(0, 4);
  return prisma.$transaction(async (tx) => {
    await assertYearsUnlocked(tx, ctx.companyId, [year]);
    await getOrCreateFiscalYear(tx, ctx.companyId, year);
    const row = await tx.debtorCreditor.create({
      data: {
        companyId: ctx.companyId, date: input.date, year, type: input.type, partyName: input.partyName,
        details: input.details, amount: big(input.amount), invoiceId: invoiceId ?? null,
      },
    });
    await audit(tx, ctx, 'DC_CREATE', 'DebtorCreditor', row.id, null, input);
    return row.id;
  });
}

export async function deleteEntry(prisma: PrismaClient, ctx: Ctx, id: string) {
  assertCan(ctx.role, 'entry:delete');
  return prisma.$transaction(async (tx) => {
    const cur = await tx.debtorCreditor.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!cur) throw new AppError('NOT_FOUND', 'Entry not found', 404);
    await assertYearsUnlocked(tx, ctx.companyId, [cur.year]);
    if (cur.invoiceId) {
      await tx.invoice.update({ where: { id: cur.invoiceId }, data: { recorded: false } });
    }
    await tx.debtorCreditor.delete({ where: { id } });
    await audit(tx, ctx, 'DC_DELETE', 'DebtorCreditor', id, { ...cur, amount: cur.amount }, null);
  });
}

export interface PartyBalance {
  type: 'DEBTOR' | 'CREDITOR';
  partyName: string;
  invoiced: number;
  settled: number;
  outstanding: number;
}

/** Outstanding by name for the year. Payments are linked by the explicit partyName on the transaction. */
export async function balancesByParty(db: Db, companyId: string, year: number): Promise<PartyBalance[]> {
  const [entries, settlements] = await Promise.all([
    db.debtorCreditor.findMany({ where: { companyId, year } }),
    db.transaction.findMany({
      where: { companyId, year, category: { group: { in: ['DEBTOR', 'CREDITOR'] } } },
      include: { category: { select: { group: true } } },
    }),
  ]);
  const map = new Map<string, PartyBalance>();
  const get = (type: 'DEBTOR' | 'CREDITOR', name: string) => {
    const k = `${type}|${name}`;
    if (!map.has(k)) map.set(k, { type, partyName: name, invoiced: 0, settled: 0, outstanding: 0 });
    return map.get(k)!;
  };
  for (const e of entries) get(e.type as 'DEBTOR' | 'CREDITOR', e.partyName).invoiced += num(e.amount);
  for (const s of settlements) {
    get(s.category.group as 'DEBTOR' | 'CREDITOR', s.partyName || '(unassigned payments)').settled += num(s.amount);
  }
  return [...map.values()]
    .map((b) => ({ ...b, outstanding: b.invoiced - b.settled }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.partyName.localeCompare(b.partyName));
}

export async function listParties(db: Db, companyId: string): Promise<{ debtors: string[]; creditors: string[] }> {
  const rows = await db.debtorCreditor.findMany({
    where: { companyId }, select: { type: true, partyName: true }, distinct: ['type', 'partyName'],
  });
  return {
    debtors: rows.filter((r) => r.type === 'DEBTOR').map((r) => r.partyName).sort(),
    creditors: rows.filter((r) => r.type === 'CREDITOR').map((r) => r.partyName).sort(),
  };
}
