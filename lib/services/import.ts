// Import pipeline: parse -> map -> categorise -> preview -> commit / undo -> learn rules.
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../errors';
import { audit } from '../audit';
import { txHash } from '../hash';
import { assertCan } from '../permissions';
import { aiEnabled, suggestCategories } from '../import/ai';
import { categorise, compileRules, learnKeyword, type CategoryLite, type RuleLite } from '../import/categorise';
import { headerSignature, type ColumnMap } from '../import/columns';
import { parseUpload, type ParsedSheet } from '../import/parse';
import { assertYearsUnlocked } from './years';
import { big, num, type Ctx, type Db } from './types';

export interface PreviewRow {
  key: string;
  date: string;
  details: string;
  direction: 'IN' | 'OUT';
  amount: number; // sen
  category: string;
  suggested: string;
  source: 'column' | 'rule' | 'learned' | 'fallback' | 'ai';
  hash: string;
  duplicate: boolean;
}

export interface PreviewSheet {
  fileName: string;
  fileType: string;
  sheetName: string;
  signature: string;
  headers: string[];
  columnMap: ColumnMap;
  mapSource: string;
  mapDescription: string;
  preview: string[][];
  warnings: string[];
  rows: PreviewRow[];
}

export async function loadCategorisationContext(db: Db, companyId: string) {
  const [cats, rules] = await Promise.all([
    db.category.findMany({ where: { companyId } }),
    db.categoryRule.findMany({ where: { companyId }, include: { category: true } }),
  ]);
  const categories: CategoryLite[] = cats.map((c) => ({ name: c.name, direction: c.direction as 'IN' | 'OUT' }));
  const ruleLites: RuleLite[] = rules.map((r) => ({
    id: r.id, pattern: r.pattern, isRegex: r.isRegex, category: r.category.name,
    direction: r.direction as 'IN' | 'OUT', priority: r.priority,
  }));
  return { categories, rules: compileRules(ruleLites) };
}

async function loadSavedFormats(db: Db, companyId: string): Promise<Map<string, ColumnMap>> {
  const formats = await db.bankFormat.findMany({ where: { companyId } });
  return new Map(formats.map((f) => [f.signature, JSON.parse(f.columnMap) as ColumnMap]));
}

export interface UploadFile {
  name: string;
  buffer: Buffer;
}

export async function previewImport(
  db: Db, companyId: string, files: UploadFile[],
  override?: { fileName?: string; sheetName?: string; columnMap: ColumnMap },
): Promise<PreviewSheet[]> {
  const [{ categories, rules }, savedFormats] = await Promise.all([
    loadCategorisationContext(db, companyId),
    loadSavedFormats(db, companyId),
  ]);

  const sheets: PreviewSheet[] = [];
  const seenInPayload = new Set<string>();
  for (const f of files) {
    const parsed: ParsedSheet[] = await parseUpload(f.buffer, f.name, {
      savedFormats,
      override: override && (!override.fileName || override.fileName === f.name)
        ? { sheetName: override.sheetName, columnMap: override.columnMap } : undefined,
    });
    for (const ps of parsed) {
      const occ = new Map<string, number>();
      const baseRows = ps.rows.map((r) => {
        const base = txHash(r.date, r.amount, r.direction, r.details, 0);
        const n = occ.get(base) ?? 0;
        occ.set(base, n + 1);
        return { r, hash: txHash(r.date, r.amount, r.direction, r.details, n) };
      });
      const existing = new Set(
        (await db.transaction.findMany({
          where: { companyId, hash: { in: baseRows.map((b) => b.hash) } }, select: { hash: true },
        })).map((t) => t.hash),
      );
      const rows: PreviewRow[] = baseRows.map(({ r, hash }, i) => {
        const c = categorise(r.details, r.direction, r.categoryHint, categories, rules);
        const duplicate = existing.has(hash) || seenInPayload.has(hash);
        seenInPayload.add(hash);
        return {
          key: `${f.name}:${ps.sheetName}:${i}`,
          date: r.date, details: r.details, direction: c.direction, amount: r.amount,
          category: c.category, suggested: c.category, source: c.source, hash, duplicate,
        };
      });
      if (aiEnabled()) {
        const pending = rows
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => r.source === 'fallback' && !r.duplicate && r.details);
        try {
          const picks = await suggestCategories(
            pending.map(({ r, i }) => ({ id: i, details: r.details, direction: r.direction })),
            categories,
          );
          for (const { r, i } of pending) {
            const c = picks.get(i);
            if (c) Object.assign(r, { category: c, suggested: c, source: 'ai' as const });
          }
        } catch {
          /* AI is best-effort; fall back to rule defaults */
        }
      }
      sheets.push({
        fileName: ps.fileName, fileType: ps.fileType, sheetName: ps.sheetName, signature: ps.signature,
        headers: ps.headers, columnMap: ps.columnMap, mapSource: ps.mapSource, mapDescription: ps.mapDescription,
        preview: ps.preview, warnings: ps.warnings, rows,
      });
    }
  }
  return sheets;
}

const commitRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  details: z.string().max(500),
  direction: z.enum(['IN', 'OUT']),
  amount: z.number().int().positive(),
  category: z.string().min(1),
  suggested: z.string().optional(),
  partyName: z.string().max(200).optional(),
});

export const commitSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().max(20).default('xlsx'),
  columnMap: z.record(z.number()).default({}),
  signature: z.string().max(64).optional(),
  bankName: z.string().max(100).optional(),
  rows: z.array(commitRow).min(1).max(100000),
});
export type CommitInput = z.infer<typeof commitSchema>;

export interface CommitResult {
  batchId: string;
  added: number;
  skipped: number;
  years: number[];
  createdYears: number[];
  switchToYear: number | null;
  learned: number;
}

export async function commitImport(
  prisma: PrismaClient, ctx: Ctx, input: CommitInput, currentYear?: number,
): Promise<CommitResult> {
  assertCan(ctx.role, 'entry:create');
  const data = commitSchema.parse(input);
  const years = [...new Set(data.rows.map((r) => +r.date.slice(0, 4)))].sort();

  return prisma.$transaction(async (tx) => {
    await assertYearsUnlocked(tx, ctx.companyId, years);

    const cats = await tx.category.findMany({ where: { companyId: ctx.companyId } });
    const byName = new Map(cats.map((c) => [c.name, c]));
    for (const r of data.rows) {
      const c = byName.get(r.category);
      if (!c) throw new AppError('BAD_CATEGORY', `Unknown category "${r.category}"`, 422);
      if (c.direction !== r.direction) {
        throw new AppError('BAD_CATEGORY', `Category "${r.category}" is a Cash ${c.direction === 'IN' ? 'In' : 'Out'} category.`, 422);
      }
    }

    // hashes (with occurrence index for repeated identical rows) and duplicate filtering
    const occ = new Map<string, number>();
    const prepared = data.rows.map((r) => {
      const base = txHash(r.date, r.amount, r.direction, r.details, 0);
      const n = occ.get(base) ?? 0;
      occ.set(base, n + 1);
      return { r, hash: txHash(r.date, r.amount, r.direction, r.details, n) };
    });
    const existing = new Set(
      (await tx.transaction.findMany({
        where: { companyId: ctx.companyId, hash: { in: prepared.map((p) => p.hash) } }, select: { hash: true },
      })).map((t) => t.hash),
    );
    const seen = new Set<string>();
    const fresh = prepared.filter((p) => {
      if (existing.has(p.hash) || seen.has(p.hash)) return false;
      seen.add(p.hash);
      return true;
    });
    const skipped = prepared.length - fresh.length;

    const existingYears = new Set(
      (await tx.fiscalYear.findMany({ where: { companyId: ctx.companyId, year: { in: years } }, select: { year: true } })).map(
        (y) => y.year,
      ),
    );
    const createdYears: number[] = [];
    for (const y of years) {
      if (!existingYears.has(y)) {
        await tx.fiscalYear.create({ data: { companyId: ctx.companyId, year: y } });
        createdYears.push(y);
      }
    }

    const batch = await tx.importBatch.create({
      data: {
        companyId: ctx.companyId, fileName: data.fileName, fileType: data.fileType, rowCount: fresh.length,
        skipped, columnMap: JSON.stringify(data.columnMap), createdBy: ctx.userId, status: 'COMMITTED',
      },
    });
    if (fresh.length) {
      await tx.transaction.createMany({
        data: fresh.map(({ r, hash }) => ({
          companyId: ctx.companyId, date: r.date, year: +r.date.slice(0, 4), direction: r.direction,
          categoryId: byName.get(r.category)!.id, details: r.details, amount: big(r.amount),
          partyName: r.partyName ?? null, source: 'IMPORT', importBatchId: batch.id, hash, createdBy: ctx.userId,
        })),
      });
    }

    // remember the column mapping for this bank format
    if (data.signature && data.signature !== 'pdf' && Object.keys(data.columnMap).length) {
      await tx.bankFormat.upsert({
        where: { companyId_signature: { companyId: ctx.companyId, signature: data.signature } },
        update: { columnMap: JSON.stringify(data.columnMap), ...(data.bankName ? { name: data.bankName } : {}) },
        create: {
          companyId: ctx.companyId, signature: data.signature, name: data.bankName ?? data.fileName,
          columnMap: JSON.stringify(data.columnMap),
        },
      });
    }

    // learn from corrections
    let learned = 0;
    const done = new Set<string>();
    for (const r of data.rows) {
      if (!r.suggested || r.suggested === r.category) continue;
      const kw = learnKeyword(r.details);
      if (!kw) continue;
      const key = `${r.direction}|${kw}`;
      if (done.has(key)) continue;
      done.add(key);
      const catId = byName.get(r.category)!.id;
      const rule = await tx.categoryRule.findFirst({
        where: { companyId: ctx.companyId, pattern: kw, isRegex: false, direction: r.direction },
      });
      if (rule) await tx.categoryRule.update({ where: { id: rule.id }, data: { categoryId: catId } });
      else {
        await tx.categoryRule.create({
          data: { companyId: ctx.companyId, pattern: kw, isRegex: false, categoryId: catId, direction: r.direction, priority: 10, learned: true },
        });
      }
      learned++;
    }

    const switchToYear = createdYears.length && (currentYear === undefined || !years.includes(currentYear))
      ? Math.max(...years) : null;
    await audit(tx, ctx, 'IMPORT_COMMIT', 'ImportBatch', batch.id, null, {
      fileName: data.fileName, added: fresh.length, skipped, years, learned,
    });
    return { batchId: batch.id, added: fresh.length, skipped, years, createdYears, switchToYear, learned };
  });
}

export async function undoImport(prisma: PrismaClient, ctx: Ctx, batchId: string) {
  assertCan(ctx.role, 'import:undo');
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findFirst({ where: { id: batchId, companyId: ctx.companyId } });
    if (!batch) throw new AppError('NOT_FOUND', 'Import batch not found', 404);
    if (batch.status === 'UNDONE') throw new AppError('ALREADY_UNDONE', 'This import was already undone.', 409);
    const rows = await tx.transaction.findMany({ where: { importBatchId: batchId }, select: { year: true } });
    await assertYearsUnlocked(tx, ctx.companyId, rows.map((r) => r.year));
    const del = await tx.transaction.deleteMany({ where: { importBatchId: batchId, companyId: ctx.companyId } });
    await tx.importBatch.update({ where: { id: batchId }, data: { status: 'UNDONE' } });
    await audit(tx, ctx, 'IMPORT_UNDO', 'ImportBatch', batchId, { rows: del.count }, { status: 'UNDONE' });
    return { removed: del.count };
  });
}

export async function listBatches(db: Db, companyId: string, limit = 20) {
  const bs = await db.importBatch.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: limit });
  return bs.map((b) => ({
    id: b.id, fileName: b.fileName, fileType: b.fileType, rowCount: b.rowCount, skipped: b.skipped,
    status: b.status, createdAt: b.createdAt.toISOString(),
  }));
}

export { headerSignature, num };
