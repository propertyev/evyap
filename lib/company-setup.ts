// Seeds the per-company reference data (categories, default rules).
import type { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES } from './categories';
import { DEFAULT_RULES } from './rules';

export async function seedCompanyDefaults(prisma: PrismaClient, companyId: string) {
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { companyId_name: { companyId, name: c.name } },
      update: {},
      create: {
        companyId, name: c.name, direction: c.direction, group: c.group, accountCode: c.code, isSystem: true,
      },
    });
  }
  const cats = await prisma.category.findMany({ where: { companyId } });
  const byName = new Map(cats.map((c) => [c.name, c.id]));
  const existing = await prisma.categoryRule.count({ where: { companyId, learned: false } });
  if (existing === 0) {
    await prisma.categoryRule.createMany({
      data: DEFAULT_RULES.map((r, i) => ({
        companyId, pattern: r.pattern, isRegex: true, categoryId: byName.get(r.category)!,
        direction: r.direction, priority: 100 + i, learned: false,
      })),
    });
  }
}
