import { InvoiceClient } from '@/components/InvoiceClient';
import { Rujukan } from '@/components/ui';
import { prisma } from '@/lib/db';
import { t } from '@/lib/i18n';
import { getPage } from '@/lib/page';
import { can } from '@/lib/permissions';
import { listInvoices } from '@/lib/services/invoices';

export default async function Page() {
  const p = await getPage();
  const invoices = await listInvoices(prisma, p.ctx.companyId);
  const c = p.company;
  return (
    <>
      <Rujukan>{t('rujukan.invoice')}</Rujukan>
      <InvoiceClient
        invoices={invoices}
        company={{ name: c.name, ssmNo: c.ssmNo, address: c.address, phone: c.phone, email: c.email, logoUrl: c.logoUrl }}
        year={p.year}
        locked={p.locked}
        canDelete={can(p.ctx.role, 'entry:delete')}
      />
    </>
  );
}
