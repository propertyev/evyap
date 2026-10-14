'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';
import { rmToSen, today } from '@/lib/format';
import { fmt } from '@/lib/money';
import { MonthSelect } from './MonthSelect';
import { useToast } from './Toast';

interface Row { id: string; date: string; type: 'DEBTOR' | 'CREDITOR'; partyName: string; details: string; amount: number }
interface Bal { type: 'DEBTOR' | 'CREDITOR'; partyName: string; invoiced: number; settled: number; outstanding: number }

export function DebtorCreditorClient({
  rows, balances, openingDebtors, openingCreditors, month, year, locked, canDelete,
}: {
  rows: Row[]; balances: Bal[]; openingDebtors: number; openingCreditors: number;
  month: number | 'all'; year: number; locked: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const { show, node } = useToast();
  const [f, setF] = useState({
    date: today().startsWith(String(year)) ? today() : `${year}-01-01`,
    type: 'DEBTOR' as 'DEBTOR' | 'CREDITOR', partyName: '', details: '', amount: '',
  });

  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) show(ok);
      router.refresh();
    } catch (e) {
      show((e as Error).message, 'err');
    }
  }

  return (
    <section>
      {!locked && (
        <form
          className="tw"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = rmToSen(f.amount);
            if (amount <= 0) return show('Enter an amount greater than zero.', 'err');
            void run(async () => {
              await apiFetch('/api/dc', { body: { ...f, amount } });
              setF({ ...f, partyName: '', details: '', amount: '' });
            }, 'Entry added.');
          }}
        >
          <table className="xl" style={{ maxWidth: 900 }}>
            <thead>
              <tr><th>DATE</th><th>DEBTOR / CREDITOR</th><th>NAME</th><th>DETAILS</th><th>AMOUNT (RM)</th><th /></tr>
            </thead>
            <tbody>
              <tr>
                <td><input aria-label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></td>
                <td>
                  <select aria-label="Debtor or creditor" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as 'DEBTOR' | 'CREDITOR' })}>
                    <option>DEBTOR</option><option>CREDITOR</option>
                  </select>
                </td>
                <td><input aria-label="Name" value={f.partyName} onChange={(e) => setF({ ...f, partyName: e.target.value })} required /></td>
                <td><input aria-label="Details" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></td>
                <td><input aria-label="Amount" className="inp" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></td>
                <td><button className="btn pri" type="submit">Add</button></td>
              </tr>
            </tbody>
          </table>
        </form>
      )}

      <div className="row" style={{ margin: '14px 0' }}>
        <MonthSelect year={year} value={month} allowAll />
      </div>
      <div className="tw">
        <table className="xl">
          <thead>
            <tr><th>DATE</th><th>DEBTOR</th><th>CREDITOR</th><th>DETAILS</th><th className="n">AMOUNT (RM)</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="note" style={{ textAlign: 'center', padding: 20 }}>Tiada rekod.</td></tr>}
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.date}</td>
                <td>{d.type === 'DEBTOR' ? d.partyName : ''}</td>
                <td>{d.type === 'CREDITOR' ? d.partyName : ''}</td>
                <td>{d.details}</td>
                <td className="n">{fmt(d.amount)}</td>
                <td>
                  {canDelete && !locked && (
                    <button className="btn red sm" type="button" aria-label="Delete entry"
                      onClick={() => run(() => apiFetch(`/api/dc/${d.id}`, { method: 'DELETE' }))}>✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="title" style={{ marginTop: 20 }}>Outstanding Balance by Name</div>
      <div className="tw">
        <table className="xl" style={{ maxWidth: 760, margin: '0 auto' }}>
          <thead>
            <tr><th>Type</th><th>Name</th><th className="n">Invoiced</th><th className="n">Paid</th><th className="n">Outstanding (RM)</th></tr>
          </thead>
          <tbody>
            {openingDebtors !== 0 && (
              <tr><td>DEBTOR</td><td>Balance brought forward (all names)</td><td className="n">{fmt(openingDebtors)}</td><td className="n">-</td><td className="n">{fmt(openingDebtors)}</td></tr>
            )}
            {openingCreditors !== 0 && (
              <tr><td>CREDITOR</td><td>Balance brought forward (all names)</td><td className="n">{fmt(openingCreditors)}</td><td className="n">-</td><td className="n">{fmt(openingCreditors)}</td></tr>
            )}
            {balances.map((b) => (
              <tr key={`${b.type}-${b.partyName}`}>
                <td>{b.type}</td><td>{b.partyName}</td>
                <td className="n">{fmt(b.invoiced)}</td><td className="n">{fmt(b.settled)}</td><td className="n">{fmt(b.outstanding)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="note">
                Payments are linked by choosing the party on a Cash In “Debtor” / Cash Out “Creditor” transaction (Cash In &amp; Cash Out page).
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {node}
    </section>
  );
}
