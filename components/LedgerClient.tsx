'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';
import { rmToSen, senToInput, today } from '@/lib/format';
import { fmt } from '@/lib/money';
import { MonthSelect } from './MonthSelect';
import { useToast } from './Toast';

interface Cat { name: string; direction: 'IN' | 'OUT'; group: string }
interface Row {
  id: string; date: string; direction: 'IN' | 'OUT'; category: string; details: string; amount: number; partyName: string | null;
}

export function LedgerClient({
  rows, categories, parties, month, year, locked, canDelete, canClear,
}: {
  rows: Row[]; categories: Cat[]; parties: { debtors: string[]; creditors: string[] };
  month: number | 'all'; year: number; locked: boolean; canDelete: boolean; canClear: boolean;
}) {
  const router = useRouter();
  const { show, node } = useToast();
  const [draft, setDraft] = useState({
    date: today().startsWith(String(year)) ? today() : `${year}-01-01`,
    direction: 'OUT' as 'IN' | 'OUT', category: 'Lain-lain Perbelanjaan', details: '', amount: '', partyName: '',
  });
  const [clearing, setClearing] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const groupOf = (n: string) => categories.find((c) => c.name === n)?.group;
  const cats = (d: 'IN' | 'OUT') => categories.filter((c) => c.direction === d);
  const partiesFor = (g?: string) => (g === 'DEBTOR' ? parties.debtors : parties.creditors);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) show(ok);
      router.refresh();
    } catch (e) {
      show((e as Error).message, 'err');
    }
  }
  const patch = (id: string, body: object) => run(() => apiFetch(`/api/transactions/${id}`, { method: 'PATCH', body }));

  const totalIn = rows.filter((r) => r.direction === 'IN').reduce((a, r) => a + r.amount, 0);
  const totalOut = rows.filter((r) => r.direction === 'OUT').reduce((a, r) => a + r.amount, 0);
  const needsParty = groupOf(draft.category) === 'DEBTOR' || groupOf(draft.category) === 'CREDITOR';

  return (
    <section>
      <div className="row" style={{ margin: '8px 0 12px' }}>
        <MonthSelect year={year} value={month} allowAll />
        {canClear && !locked && (
          <button className="btn red" type="button" onClick={() => setClearing(true)}>
            <i>✕</i>Clear All
          </button>
        )}
      </div>

      {!locked && (
        <form
          className="tw"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = rmToSen(draft.amount);
            if (amount <= 0) return show('Enter an amount greater than zero.', 'err');
            void run(async () => {
              await apiFetch('/api/transactions', {
                body: {
                  date: draft.date, direction: draft.direction, category: draft.category, details: draft.details, amount,
                  partyName: needsParty ? draft.partyName || null : null,
                },
              });
              setDraft({ ...draft, details: '', amount: '', partyName: '' });
            }, 'Entry added.');
          }}
        >
          <table className="xl">
            <thead>
              <tr><th>+ Manual entry</th><th>In / Out</th><th>Category</th><th>Details</th><th>Party</th><th className="n">Amount (RM)</th><th /></tr>
            </thead>
            <tbody>
              <tr>
                <td><input aria-label="Date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required /></td>
                <td>
                  <select
                    aria-label="Cash in or out"
                    value={draft.direction}
                    onChange={(e) => {
                      const d = e.target.value as 'IN' | 'OUT';
                      setDraft({ ...draft, direction: d, category: d === 'IN' ? 'Sales' : 'Lain-lain Perbelanjaan', partyName: '' });
                    }}
                  >
                    <option value="IN">Cash In</option>
                    <option value="OUT">Cash Out</option>
                  </select>
                </td>
                <td>
                  <select aria-label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value, partyName: '' })}>
                    {cats(draft.direction).map((c) => <option key={c.name}>{c.name}</option>)}
                  </select>
                </td>
                <td><input aria-label="Details" value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} /></td>
                <td>
                  {needsParty && (
                    <>
                      <input aria-label="Party name" list="party-list" value={draft.partyName} placeholder="Name"
                        onChange={(e) => setDraft({ ...draft, partyName: e.target.value })} required />
                      <datalist id="party-list">{partiesFor(groupOf(draft.category)).map((p) => <option key={p} value={p} />)}</datalist>
                    </>
                  )}
                </td>
                <td><input aria-label="Amount" inputMode="decimal" className="inp" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} required /></td>
                <td><button className="btn pri sm" type="submit">Add</button></td>
              </tr>
            </tbody>
          </table>
        </form>
      )}

      <div className="tw" style={{ marginTop: 14 }}>
        <table className="xl" aria-label="Cash in and cash out ledger">
          <thead>
            <tr>
              <th>Date</th><th>Category</th><th>Details</th><th>Party</th><th className="n">Cash In</th><th className="n">Cash Out</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="note" style={{ padding: 30, textAlign: 'center' }}>No transactions yet — drop a file on the Import page.</td></tr>
            )}
            {rows.map((r) => {
              const g = groupOf(r.category);
              const isParty = g === 'DEBTOR' || g === 'CREDITOR';
              return (
                <tr key={r.id}>
                  <td>
                    <input aria-label="Date" type="date" defaultValue={r.date} disabled={locked}
                      onBlur={(e) => e.target.value && e.target.value !== r.date && patch(r.id, { date: e.target.value })} />
                  </td>
                  <td>
                    <select aria-label="Category" defaultValue={r.category} disabled={locked}
                      onChange={(e) => patch(r.id, { category: e.target.value })}>
                      {categories.map((c) => <option key={c.name}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input aria-label="Details" defaultValue={r.details} disabled={locked} style={{ minWidth: 180 }}
                      onBlur={(e) => e.target.value !== r.details && patch(r.id, { details: e.target.value })} />
                  </td>
                  <td>
                    {isParty && (
                      <input aria-label="Party name" list="party-list-row" defaultValue={r.partyName ?? ''} disabled={locked}
                        onBlur={(e) => e.target.value !== (r.partyName ?? '') && patch(r.id, { partyName: e.target.value || null })} />
                    )}
                  </td>
                  {(['IN', 'OUT'] as const).map((d) => (
                    <td key={d} className="n">
                      {r.direction === d && (
                        <input aria-label={`Amount ${d === 'IN' ? 'cash in' : 'cash out'}`} className="inp" style={{ width: 100 }}
                          defaultValue={senToInput(r.amount)} disabled={locked}
                          onBlur={(e) => {
                            const v = rmToSen(e.target.value);
                            if (v > 0 && v !== r.amount) void patch(r.id, { amount: v });
                          }} />
                      )}
                    </td>
                  ))}
                  <td>
                    {canDelete && !locked && (
                      <button className="btn red sm" type="button" aria-label="Delete entry"
                        onClick={() => run(() => apiFetch(`/api/transactions/${r.id}`, { method: 'DELETE' }))}>✕</button>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="tot">
              <td colSpan={4}>Total</td>
              <td className="n">{fmt(totalIn)}</td>
              <td className="n">{fmt(totalOut)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <datalist id="party-list-row">
          {[...parties.debtors, ...parties.creditors].map((p) => <option key={p} value={p} />)}
        </datalist>
      </div>

      {clearing && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Clear all transactions">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="title" style={{ textAlign: 'left' }}>Delete all {year} transactions?</div>
            <p>This removes every Cash In / Cash Out entry for {year}. It cannot be undone. Type <b>DELETE {year}</b> to confirm.</p>
            <input aria-label="Confirmation" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={{ width: '100%' }} />
            <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn" type="button" onClick={() => { setClearing(false); setConfirmText(''); }}>Cancel</button>
              <button className="btn red" type="button" disabled={confirmText.trim() !== `DELETE ${year}`}
                onClick={() => run(async () => {
                  await apiFetch('/api/transactions/clear', { body: { year, confirmation: confirmText } });
                  setClearing(false);
                  setConfirmText('');
                }, 'All transactions cleared.')}>
                Delete everything
              </button>
            </div>
          </div>
        </div>
      )}
      {node}
    </section>
  );
}
