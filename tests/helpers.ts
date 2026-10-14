import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { seedCompanyDefaults } from '@/lib/company-setup';
import type { Ctx, Role } from '@/lib/services/types';

const url = process.env.TEST_DATABASE_URL || `file:${resolve(process.cwd(), 'tests/.tmp/test.db')}`;
export const prisma = new PrismaClient({ datasourceUrl: url });

export async function newCompany(role: Role = 'OWNER'): Promise<Ctx> {
  const c = await prisma.company.create({ data: { name: `Test ${randomUUID().slice(0, 6)}` } });
  await seedCompanyDefaults(prisma, c.id);
  return { companyId: c.id, userId: null, role };
}

export const asRole = (ctx: Ctx, role: Role): Ctx => ({ ...ctx, role });
