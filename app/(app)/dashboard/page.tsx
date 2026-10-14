import { DashboardChart } from '@/components/DashboardChart';
import { fmt } from '@/lib/money';
import { getPage } from '@/lib/page';
import { monthHeaders } from '@/lib/statements';

export default async function Dashboard() {
  const { result: r, year } = await getPage();
  const expenses = r.cogs + r.operatingExpenses;
  return (
    <section>
      <div className="kpis">
        <div className="kpi y">
          Sales
          <div className="v">{r.sales ? fmt(r.sales) : '-'}</div>
        </div>
        <div className="kpi n">
          Profit
          <div className="v">{r.netProfit ? fmt(r.netProfit) : '-'}</div>
        </div>
      </div>
      <DashboardChart labels={monthHeaders(year)} sales={r.salesM} profit={r.netProfitM} />
      <div className="title" style={{ font: '700 16px Poppins', color: 'var(--navy)', marginTop: 14 }}>Monthly Profit</div>
      <div className="pill-wrap">
        <div>Expenses<b>{fmt(expenses)}</b></div>
        <div>Cash Balance<b>{fmt(r.cash)}</b></div>
        <div>Baki Mula<b>{fmt(r.cashFlow.opening)}</b></div>
        <div>Transactions<b>{r.txCount}</b></div>
        <div>Trade Debtor<b>{fmt(r.tradeDebtors)}</b></div>
        <div>Creditor<b>{fmt(r.creditors)}</b></div>
      </div>
    </section>
  );
}
