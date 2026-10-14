import { GridTable, PageHeader } from '@/components/ui';
import { getPage } from '@/lib/page';
import { performance } from '@/lib/statements';

export default async function Page() {
  const { result, company, year } = await getPage();
  return (
    <section>
      <PageHeader title="Performance Review" company={company.name} year={year} />
      <GridTable g={performance(result)} maxWidth={640} />
    </section>
  );
}
