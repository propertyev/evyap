import { DebtorCreditorClient } from '@/components/DebtorCreditorClient';
import { Rujukan } from '@/components/ui';
import { prisma } from '@/lib/db';
import { t } from '@/lib/i18n';
import { getPage } from '@/lib/page';
import { can } from '@/lib/permissions';
import { balancesByParty, listEntries } from '@/lib/services/dc';

export default async function Page({ searchParams }: { searchParams: { m?: string } }) {
  const p = await getPage();
  const raw = searchParams.m;
  const month: number | 'all' = raw === undefined || raw === 'all' ? 'all' : Math.min(11, Math.max(0, Number(raw) || 0));
  const [rows, balances] = await Promise.all([
    listEntries(prisma, p.ctx.companyId, p.year, month === 'all' ? undefined : month),
    balancesByParty(prisma, p.ctx.companyId, p.year),
  ]);
  return (
    <>
      <Rujukan>{t('rujukan.dc')}</Rujukan>
      <DebtorCreditorClient
        rows={rows}
        balances={balances}
        openingDebtors={p.input.opening.tradeDebtors}
        openingCreditors={p.input.opening.creditors}
        month={month}
        year={p.year}
        locked={p.locked}
        canDelete={can(p.ctx.role, 'entry:delete')}
      />
    </>
  );
}
