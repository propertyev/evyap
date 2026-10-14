import { PageHeader, TallyBadge } from '@/components/ui';
import { fmt } from '@/lib/money';
import { getPage } from '@/lib/page';

export default async function Page() {
  const { result: r, company, year } = await getPage();
  const tb = r.trialBalance;
  return (
    <section>
      <PageHeader title="Trial Balance" company={company.name} year={year} />
      <TallyBadge difference={tb.totalDebit - tb.totalCredit} />
      <div className="tw">
        <table className="xl" style={{ maxWidth: 760, margin: '0 auto' }}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Grouping to the Financial Statements</th>
              <th className="n">Debit</th>
              <th className="n">Credit</th>
            </tr>
          </thead>
          <tbody>
            {tb.sections.map((s) => {
              const rows = s.rows.filter((x) => x.debit || x.credit);
              return (
                <FragmentRows key={s.title} title={s.title} rows={rows.length ? rows : s.rows.slice(0, 1)} />
              );
            })}
            <tr className="tot">
              <td />
              <td>Total</td>
              <td className="n">{fmt(tb.totalDebit)}</td>
              <td className="n">{fmt(tb.totalCredit)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="note">
                Closing stock ({fmt(r.closingStock)}) is adjusted outside the trial balance, as in CmPro.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentRows({ title, rows }: { title: string; rows: { code: number; name: string; debit: number; credit: number }[] }) {
  return (
    <>
      <tr className="sec">
        <td colSpan={4}>{title}</td>
      </tr>
      {rows.map((x) => (
        <tr key={`${x.code}-${x.name}`}>
          <td>{x.code}</td>
          <td>{x.name}</td>
          <td className="n">{fmt(x.debit, { dash: true })}</td>
          <td className="n">{fmt(x.credit, { dash: true })}</td>
        </tr>
      ))}
    </>
  );
}
