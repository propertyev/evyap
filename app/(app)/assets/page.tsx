import { AssetsClient } from '@/components/AssetsClient';
import { PageHeader, Rujukan } from '@/components/ui';
import { t } from '@/lib/i18n';
import { getPage } from '@/lib/page';
import { can } from '@/lib/permissions';

export default async function Page() {
  const p = await getPage();
  return (
    <section>
      <PageHeader title="Assets" company={p.company.name} year={p.year} />
      <Rujukan>{t('rujukan.assets')}</Rujukan>
      <AssetsClient assets={p.result.assets} year={p.year} locked={p.locked} canEdit={can(p.ctx.role, 'settings:edit')} />
    </section>
  );
}
