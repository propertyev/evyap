import { Rujukan } from '@/components/ui';
import { SetupClient } from '@/components/SetupClient';
import { prisma } from '@/lib/db';
import { t } from '@/lib/i18n';
import { getPage } from '@/lib/page';
import { can } from '@/lib/permissions';
import { listUsers } from '@/lib/services/users';

export default async function Page() {
  const p = await getPage();
  const o = p.input.opening;
  const users = can(p.ctx.role, 'users:manage') ? await listUsers(prisma, p.ctx.companyId) : [];
  const c = p.company;
  return (
    <>
      <Rujukan>{t('rujukan.setup')}</Rujukan>
      <SetupClient
        company={{ name: c.name, ssmNo: c.ssmNo, address: c.address, phone: c.phone, email: c.email, logoUrl: c.logoUrl }}
        figures={{
          closingStock: p.input.closingStock, openStock: o.stock, openCapital: o.capital, openPL: o.pl, openCash: o.cash,
          openLongTermLoan: o.longTermLoan, openOtherLTLiab: o.otherLTLiab, openAdvances: o.advances,
          openTradeDebtors: o.tradeDebtors, openCreditors: o.creditors,
        }}
        openingTally={p.result.openingTally}
        year={p.year}
        locked={p.locked}
        canEdit={can(p.ctx.role, 'settings:edit')}
        canClose={can(p.ctx.role, 'year:close')}
        canReopen={can(p.ctx.role, 'year:reopen')}
        canManageUsers={can(p.ctx.role, 'users:manage')}
        canAudit={can(p.ctx.role, 'audit:view')}
        users={users}
        tally={p.result.tally}
      />
    </>
  );
}
