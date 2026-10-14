import { GridTable, PageHeader } from '@/components/ui';
import { getPage } from '@/lib/page';
import { plSummary } from '@/lib/statements';

export default async function Page() {
  const { result, company, year, cats } = await getPage();
  const g = plSummary(result, cats);
  return (
    <section>
      <PageHeader title={g.title} company={company.name} year={year} />
      <GridTable g={g} />
    </section>
  );
}
