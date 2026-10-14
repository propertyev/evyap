import { LedgerClient } from '@/components/LedgerClient';
import { Rujukan } from '@/components/ui';
import { prisma } from '@/lib/db';
import { t } from '@/lib/i18n';
import { getPage } from '@/lib/page';
import { can } from '@/lib/permissions';
import { listParties } from '@/lib/services/dc';
import { listTransactions } from '@/lib/services/ledger';

export default async function Page({ searchParams }: { searchParams: { m?: string } }) {
  const p = await getPage();
  const raw = searchParams.m;
  const month: number | 'all' = raw === undefined || raw === 'all' ? 'all' : Math.min(11, Math.max(0, Number(raw) || 0));
  const [rows, parties, cats] = await Promise.all([
    listTransactions(prisma, p.ctx.companyId, p.year, month === 'all' ? undefined : month),
    listParties(prisma, p.ctx.companyId),
    prisma.category.findMany({ where: { companyId: p.ctx.companyId }, orderBy: { accountCode: 'asc' } }),
  ]);
  return (
    <>
      <Rujukan>{t('rujukan.pickMonth')}</Rujukan>
      <LedgerClient
        rows={rows}
        categories={cats.map((c) => ({ name: c.name, direction: c.direction as 'IN' | 'OUT', group: c.group }))}
        parties={parties}
        month={month}
        year={p.year}
        locked={p.locked}
        canDelete={can(p.ctx.role, 'entry:delete')}
        canClear={can(p.ctx.role, 'data:clear')}
      />
    </>
  );
}
