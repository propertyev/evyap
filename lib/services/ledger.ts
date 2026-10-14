// Cash In & Cash Out ledger: list / create / update / delete / clear.
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { audit } from '../audit';
import { AppError } from '../errors';
import { assertCan } from '../permissions';
import { txHash } from '../hash';
import { assertYearsUnlocked, getOrCreateFiscalYear } from './years';
import { big, num, type Ctx, type Db } from './types';

export interface LedgerRow {
  id: string;
  date: string;
  direction: 'IN' | 'OUT';
  category: string;
  details: string;
  amount: number;
  partyName: string | null;
  source: string;
}

export async function listTransactions(db: Db, companyId: string, year: number, month?: number): Promise<LedgerRow[]> {
  const prefix = month === undefined ? `${year}-` : `${year}-${String(month + 1).padStart(2, '0')}-`;
  const rows = await db.transaction.findMany({
    where: { companyId, year, date: { startsWith: prefix } },
    include: { category: { select: { name: true } } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id, date: r.date, direction: r.direction as 'IN' | 'OUT', category: r.category.name,
    details: r.details, amount: num(r.amount), partyName: r.partyName, source: r.source,
  }));
}

export const txInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  direction: z.enum(['IN', 'OUT']),
  category: z.string().min(1),
  details: z.string().max(500).default(''),
  amount: z.number().int().positive('Amount must be greater than zero'),
  partyName: z.string().max(200).nullish(),
});
export type TxInput = z.infer<typeof txInput>;

async function categoryByName(db: Db, companyId: string, name: string) {
  const c = await db.category.findUnique({ where: { companyId_name: { companyId, name } } });
  if (!c) throw new AppError('BAD_CATEGORY', `Unknown category "${name}"`, 422);
  return c;
}

export async function createTransaction(prisma: PrismaClient, ctx: Ctx, raw: TxInput, source: 'MANUAL' | 'RECEIPT' = 'MANUAL') {
  assertCan(ctx.role, 'entry:create');
  const input = txInput.parse(raw);
  const year = +input.date.slice(0, 4);
  return prisma.$transaction(async (tx) => {
    await assertYearsUnlocked(tx, ctx.companyId, [year]);
    const cat = await categoryByName(tx, ctx.companyId, input.category);
    if (cat.direction !== input.direction) {
      throw new AppError('BAD_CATEGORY', `"${cat.name}" is a Cash ${cat.direction === 'IN' ? 'In' : 'Out'} category.`, 422);
    }
    if ((cat.group === 'DEBTOR' || cat.group === 'CREDITOR') && !input.partyName) {
      throw new AppError('PARTY_REQUIRED', `Choose the ${cat.group === 'DEBTOR' ? 'debtor' : 'creditor'} this payment relates to.`, 422);
    }
    await getOrCreateFiscalYear(tx, ctx.companyId, year);
    const row = await tx.transaction.create({
      data: {
        companyId: ctx.companyId, date: input.date, year, direction: input.direction, categoryId: cat.id,
        details: input.details, amount: big(input.amount), partyName: input.partyName ?? null,
        source, hash: `${source.toLowerCase()}:${randomUUID()}`, createdBy: ctx.userId,
      },
    });
    await audit(tx, ctx, 'TX_CREATE', 'Transaction', row.id, null, { ...input, source });
    return row.id;
  });
}

export const txPatch = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.string().min(1).optional(),
  details: z.string().max(500).optional(),
  amount: z.number().int().positive().optional(),
  partyName: z.string().max(200).nullable().optional(),
});

export async function updateTransaction(prisma: PrismaClient, ctx: Ctx, id: string, raw: z.infer<typeof txPatch>) {
  assertCan(ctx.role, 'entry:create');
  const patch = txPatch.parse(raw);
  return prisma.$transaction(async (tx) => {
    const cur = await tx.transaction.findFirst({
      where: { id, companyId: ctx.companyId }, include: { category: true },
    });
    if (!cur) throw new AppError('NOT_FOUND', 'Transaction not found', 404);
    const newYear = patch.date ? +patch.date.slice(0, 4) : cur.year;
    await assertYearsUnlocked(tx, ctx.companyId, [cur.year, newYear]);
    const data: Record<string, unknown> = {};
    if (patch.date) {
      data.date = patch.date;
      data.year = newYear;
      await getOrCreateFiscalYear(tx, ctx.companyId, newYear);
    }
    if (patch.details !== undefined) data.details = patch.details;
    if (patch.amount !== undefined) data.amount = big(patch.amount);
    if (patch.partyName !== undefined) data.partyName = patch.partyName;
    if (patch.category) {
      const cat = await categoryByName(tx, ctx.companyId, patch.category);
      data.categoryId = cat.id;
      data.direction = cat.direction;
      if (cat.group !== 'DEBTOR' && cat.group !== 'CREDITOR' && patch.partyName === undefined) data.partyName = null;
    }
    await tx.transaction.update({ where: { id }, data });
    await audit(tx, ctx, 'TX_UPDATE', 'Transaction', id,
      { date: cur.date, category: cur.category.name, details: cur.details, amount: cur.amount, partyName: cur.partyName }, patch);
  });
}

export async function deleteTransaction(prisma: PrismaClient, ctx: Ctx, id: string) {
  assertCan(ctx.role, 'entry:delete');
  return prisma.$transaction(async (tx) => {
    const cur = await tx.transaction.findFirst({ where: { id, companyId: ctx.companyId }, include: { category: true } });
    if (!cur) throw new AppError('NOT_FOUND', 'Transaction not found', 404);
    await assertYearsUnlocked(tx, ctx.companyId, [cur.year]);
    await tx.transaction.delete({ where: { id } });
    await audit(tx, ctx, 'TX_DELETE', 'Transaction', id,
      { date: cur.date, direction: cur.direction, category: cur.category.name, details: cur.details, amount: cur.amount }, null);
  });
}

/** OWNER only; requires typing "DELETE <year>" as confirmation. */
export async function clearYear(prisma: PrismaClient, ctx: Ctx, year: number, confirmation: string) {
  assertCan(ctx.role, 'data:clear');
  if (confirmation.trim() !== `DELETE ${year}`) {
    throw new AppError('CONFIRMATION', `Type "DELETE ${year}" to confirm.`, 422);
  }
  return prisma.$transaction(async (tx) => {
    await assertYearsUnlocked(tx, ctx.companyId, [year]);
    const del = await tx.transaction.deleteMany({ where: { companyId: ctx.companyId, year } });
    await audit(tx, ctx, 'TX_CLEAR_YEAR', 'Transaction', String(year), { rows: del.count }, null);
    return { removed: del.count };
  });
}

export { txHash };
