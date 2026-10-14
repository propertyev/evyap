import { ImportClient } from '@/components/ImportClient';
import { Rujukan } from '@/components/ui';
import { prisma } from '@/lib/db';
import { t } from '@/lib/i18n';
import { getPage } from '@/lib/page';
import { can } from '@/lib/permissions';
import { listParties } from '@/lib/services/dc';
import { listBatches } from '@/lib/services/import';

export default async function Page() {
  const p = await getPage();
  const [batches, parties, cats] = await Promise.all([
    listBatches(prisma, p.ctx.companyId),
    listParties(prisma, p.ctx.companyId),
    prisma.category.findMany({ where: { companyId: p.ctx.companyId }, orderBy: { accountCode: 'asc' } }),
  ]);
  return (
    <>
      <Rujukan>{t('rujukan.import')}</Rujukan>
      <ImportClient
        categories={cats.map((c) => ({ name: c.name, direction: c.direction as 'IN' | 'OUT', group: c.group }))}
        batches={batches}
        canUndo={can(p.ctx.role, 'import:undo')}
        parties={parties}
        locked={p.locked}
      />
    </>
  );
}
