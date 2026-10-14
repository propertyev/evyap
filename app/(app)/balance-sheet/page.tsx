import { PageHeader, StatementTable, TallyBadge } from '@/components/ui';
import { getPage } from '@/lib/page';
import { balanceSheet } from '@/lib/statements';

export default async function Page() {
  const { result, company, year } = await getPage();
  const s = balanceSheet(result);
  return (
    <section>
      <PageHeader title={s.title} company={company.name} year={year} />
      <TallyBadge difference={result.tally} />
      <StatementTable s={s} />
    </section>
  );
}
