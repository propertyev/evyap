'use client';

import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';
import { rmToSen, senToInput } from '@/lib/format';
import { fmt } from '@/lib/money';
import { useToast } from './Toast';

interface A { category: string; openingNBV: number; cost: number; additions: number; ratePct: number; depreciation: number; closingNBV: number }

export function AssetsClient({ assets, year, locked, canEdit }: { assets: A[]; year: number; locked: boolean; canEdit: boolean }) {
  const router = useRouter();
  const { show, node } = useToast();
  const disabled = locked || !canEdit;
  const tot = assets.reduce(
    (t, a) => ({ open: t.open + a.openingNBV, cost: t.cost + a.cost, add: t.add + a.additions, dep: t.dep + a.depreciation, close: t.close + a.closingNBV }),
    { open: 0, cost: 0, add: 0, dep: 0, close: 0 },
  );

  async function save(a: A, patch: Partial<{ openingNBV: number; cost: number; ratePct: number }>) {
    try {
      await apiFetch('/api/assets', {
        method: 'PUT',
        body: { year, asset: { category: a.category, openingNBV: a.openingNBV, cost: a.cost, ratePct: a.ratePct, ...patch } },
      });
      router.refresh();
    } catch (e) {
      show((e as Error).message, 'err');
    }
  }

  return (
    <div className="tw">
      <table className="xl">
        <thead>
          <tr>
            <th>Year ended {year}</th><th className="n">Opening net book value</th><th className="n">Costs</th><th className="n">Additions</th>
            <th className="n">Depreciation Rate (%)</th><th className="n">Depreciation charge</th><th className="n">Closing net book value</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.category}>
              <td>{a.category}</td>
              <td className="n"><input className="inp" aria-label={`${a.category} opening NBV`} disabled={disabled} defaultValue={senToInput(a.openingNBV)}
                onBlur={(e) => rmToSen(e.target.value) !== a.openingNBV && save(a, { openingNBV: rmToSen(e.target.value) })} /></td>
              <td className="n"><input className="inp" aria-label={`${a.category} cost`} disabled={disabled} defaultValue={senToInput(a.cost)}
                onBlur={(e) => rmToSen(e.target.value) !== a.cost && save(a, { cost: rmToSen(e.target.value) })} /></td>
              <td className="n">{fmt(a.additions)}</td>
              <td className="n"><input className="inp" style={{ width: 70 }} aria-label={`${a.category} rate`} disabled={disabled} defaultValue={a.ratePct || ''}
                onBlur={(e) => {
                  const v = Number(e.target.value) || 0;
                  if (v !== a.ratePct) void save(a, { ratePct: v });
                }} /></td>
              <td className="n">{fmt(a.depreciation)}</td>
              <td className="n">{fmt(a.closingNBV)}</td>
            </tr>
          ))}
          <tr className="tot">
            <td>Total</td><td className="n">{fmt(tot.open)}</td><td className="n">{fmt(tot.cost)}</td><td className="n">{fmt(tot.add)}</td>
            <td /><td className="n">{fmt(tot.dep)}</td><td className="n">{fmt(tot.close)}</td>
          </tr>
        </tbody>
      </table>
      {node}
    </div>
  );
}
