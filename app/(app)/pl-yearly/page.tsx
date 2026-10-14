import { PageHeader, StatementTable } from '@/components/ui';
import { getPage } from '@/lib/page';
import { plYearly } from '@/lib/statements';

export default async function Page() {
  const { result, company, year } = await getPage();
  const s = plYearly(result);
  return (
    <section>
      <PageHeader title={s.title} company={company.name} year={year} />
      <StatementTable s={s} />
    </section>
  );
}
