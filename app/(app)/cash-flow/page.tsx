import { PageHeader, StatementTable } from '@/components/ui';
import { getPage } from '@/lib/page';
import { cashFlow } from '@/lib/statements';

export default async function Page() {
  const { result, company, year } = await getPage();
  const s = cashFlow(result);
  return (
    <section>
      <PageHeader title={s.title} company={company.name} year={year} />
      <StatementTable s={s} showNotes={false} />
    </section>
  );
}
