// Loads (and lazily creates) the per-year-of-assessment relief and band config.
import type { PrismaClient } from '@prisma/client';
import { DEFAULT_BANDS, DEFAULT_RELIEFS, type BandConfig, type ReliefConfig, type ReliefKind } from './tax';

export async function ensureTaxConfig(prisma: PrismaClient, yearOfAssessment: number) {
  const n = await prisma.taxReliefConfig.count({ where: { yearOfAssessment } });
  if (n === 0) {
    await prisma.taxReliefConfig.createMany({
      data: DEFAULT_RELIEFS.map((r) => ({
        yearOfAssessment, idx: r.idx, label: r.label, limit: BigInt(r.limit), kind: r.kind,
      })),
    });
  }
  const b = await prisma.taxBandConfig.count({ where: { yearOfAssessment } });
  if (b === 0) {
    await prisma.taxBandConfig.createMany({
      data: DEFAULT_BANDS.map((x, position) => ({
        yearOfAssessment, position, upTo: x.upTo === null ? null : BigInt(x.upTo), ratePct: x.ratePct,
      })),
    });
  }
}

export async function loadTaxConfig(prisma: PrismaClient, yearOfAssessment: number) {
  await ensureTaxConfig(prisma, yearOfAssessment);
  const [r, b] = await Promise.all([
    prisma.taxReliefConfig.findMany({ where: { yearOfAssessment }, orderBy: { idx: 'asc' } }),
    prisma.taxBandConfig.findMany({ where: { yearOfAssessment }, orderBy: { position: 'asc' } }),
  ]);
  const reliefs: ReliefConfig[] = r.map((x) => ({
    idx: x.idx, label: x.label, limit: Number(x.limit), kind: x.kind as ReliefKind,
  }));
  const bands: BandConfig[] = b.map((x) => ({ upTo: x.upTo === null ? null : Number(x.upTo), ratePct: x.ratePct }));
  return { reliefs, bands };
}
