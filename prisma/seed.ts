import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedCompanyDefaults } from '../lib/company-setup';
import { ensureTaxConfig } from '../lib/tax-config';
import { seedDemoData } from '../lib/demo-data';

function loadEnv() {
  const p = resolve(process.cwd(), '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_OWNER_EMAIL || 'owner@evyap.local').toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD || 'ChangeMe-EVyap-2026';
  const year = new Date().getFullYear();

  let company = await prisma.company.findFirst({ where: { name: 'EVyap' } });
  if (!company) company = await prisma.company.create({ data: { name: 'EVyap' } });

  await seedCompanyDefaults(prisma, company.id);
  await prisma.fiscalYear.upsert({
    where: { companyId_year: { companyId: company.id, year } },
    update: {},
    create: { companyId: company.id, year },
  });
  await ensureTaxConfig(prisma, year);

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { companyId: company.id, name: 'EVyap Owner', email, passwordHash, role: 'OWNER' },
  });

  if (process.env.SEED_DEMO === 'true') {
    await seedDemoData(prisma, company.id);
    console.log('Demo data (acceptance fixture, FY2026) loaded.');
  }
  console.log(`Seed complete. Owner login: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
