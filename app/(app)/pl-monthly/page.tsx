import { MonthSelect } from '@/components/MonthSelect';
import { PageHeader, StatementTable } from '@/components/ui';
import { t } from '@/lib/i18n';
import { getPage } from '@/lib/page';
import { plMonthly } from '@/lib/statements';

export default async function Page({ searchParams }: { searchParams: { m?: string } }) {
  const { result, company, year } = await getPage();
  const m = Math.min(11, Math.max(0, Number(searchParams.m ?? new Date().getMonth()) || 0));
  const s = plMonthly(result, m);
  return (
    <section>
      <PageHeader title={s.title} company={company.name} year={year} />
      <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}>
        <b>{t('rujukan.pickMonthPL')}</b>
        <MonthSelect year={year} value={m} label="" />
      </div>
      <StatementTable s={s} showNotes={false} />
    </section>
  );
}
