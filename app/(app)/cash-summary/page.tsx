import { GridTable, PageHeader } from '@/components/ui';
import { getPage } from '@/lib/page';
import { cashSummary } from '@/lib/statements';

export default async function Page() {
  const { result, company, year, cats, input } = await getPage();
  const g = cashSummary(result, input.opening.cash, cats);
  return (
    <section>
      <PageHeader title={g.title} company={company.name} year={year} />
      <GridTable g={g} />
    </section>
  );
}
