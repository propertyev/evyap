import { PageHeader, StatementTable } from '@/components/ui';
import { getPage } from '@/lib/page';
import { notes } from '@/lib/statements';

export default async function Page() {
  const { result, company, year, cats } = await getPage();
  const s = notes(result, cats);
  return (
    <section>
      <PageHeader title={s.title} company={company.name} year={year} />
      <StatementTable s={s} showNotes={false} />
    </section>
  );
}
