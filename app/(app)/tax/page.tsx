import { PageHeader, Rujukan } from '@/components/ui';
import { TaxClient } from '@/components/TaxClient';
import { prisma } from '@/lib/db';
import { t } from '@/lib/i18n';
import { getPage } from '@/lib/page';
import { can } from '@/lib/permissions';
import { loadTaxReport } from '@/lib/services/setup';

export default async function Page() {
  const p = await getPage();
  const r = await loadTaxReport(prisma, p.ctx.companyId, p.year);
  return (
    <section>
      <PageHeader title="Tax & Zakat Estimation" company={p.company.name} year={p.year} />
      <Rujukan>{t('rujukan.tax')}</Rujukan>
      <TaxClient result={r.result} zakatPct={r.zakatPct} claims={r.claims} childCounts={r.childCounts} year={p.year} locked={p.locked || !can(p.ctx.role, 'settings:edit')} />
    </section>
  );
}
