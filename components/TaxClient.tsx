'use client';

import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';
import { rmToSen, senToInput } from '@/lib/format';
import { fmt } from '@/lib/money';
import type { TaxResult } from '@/lib/tax';
import { t } from '@/lib/i18n';
import { useToast } from './Toast';

const rm0 = (sen: number) => fmt(sen).replace(/\.00$/, '');

export function TaxClient({
  result, zakatPct, claims, childCounts, year, locked,
}: {
  result: TaxResult; zakatPct: number; claims: Record<number, number>; childCounts: Record<number, number>;
  year: number; locked: boolean;
}) {
  const router = useRouter();
  const { show, node } = useToast();

  async function save(next: { zakatPct?: number; zakatPaid?: number; claims?: Record<number, number>; childCounts?: Record<number, number> }) {
    try {
      await apiFetch('/api/tax', {
        method: 'PUT',
        body: {
          year,
          settings: {
            zakatPct: next.zakatPct ?? zakatPct,
            zakatPaid: next.zakatPaid ?? result.zakatPaid,
            reliefs: next.claims ?? claims,
            childCounts: next.childCounts ?? childCounts,
          },
        },
      });
      router.refresh();
    } catch (e) {
      show((e as Error).message, 'err');
    }
  }

  return (
    <div>
      <h3 className="title">Seksyen A : Zakat &amp; Pelepasan Cukai Individu Pemastautin Tahun Taksiran {year}</h3>
      <table className="stmt">
        <tbody>
          <tr><td>Profit / (Loss) before zakat/tax</td><td className="nt" /><td className="n">{fmt(result.pbt)}</td></tr>
          <tr>
            <td>Zakat yang wajib dibayar</td>
            <td className="nt">
              <input className="inp" style={{ width: 60 }} aria-label="Zakat percentage" type="number" step="0.1" disabled={locked}
                defaultValue={zakatPct} onBlur={(e) => Number(e.target.value) !== zakatPct && save({ zakatPct: Number(e.target.value) || 0 })} />%
            </td>
            <td className="n">{fmt(result.zakat)}</td>
          </tr>
          <tr className="gt"><td>Profit / (Loss) after zakat</td><td className="nt" /><td className="n">{fmt(result.afterZakat)}</td></tr>
        </tbody>
      </table>

      <div className="tw" style={{ marginTop: 18 }}>
        <table className="xl" style={{ maxWidth: 900, margin: '0 auto' }}>
          <thead>
            <tr><th>No</th><th>Pelepasan</th><th className="n">Terhad (RM)</th><th className="n">Tuntutan</th><th className="n">RM</th></tr>
          </thead>
          <tbody>
            {result.reliefLines.map((l, i) => (
              <tr key={l.idx}>
                <td>{i + 1}</td>
                <td>{l.label}</td>
                <td className="n">{l.kind === 'FIXED' ? 'Tetap ' : ''}{rm0(l.limit)}{l.kind === 'PER' ? ' /anak' : ''}</td>
                <td className="n">
                  {l.kind === 'CAPPED' && (
                    <input className="inp" aria-label={`Claim: ${l.label}`} disabled={locked} defaultValue={senToInput(claims[l.idx] ?? 0)}
                      onBlur={(e) => {
                        const v = rmToSen(e.target.value);
                        if (v !== (claims[l.idx] ?? 0)) void save({ claims: { ...claims, [l.idx]: v } });
                      }} />
                  )}
                  {l.kind === 'PER' && (
                    <input className="inp" style={{ width: 60 }} type="number" min={0} placeholder="bil." aria-label={`Children: ${l.label}`}
                      disabled={locked} defaultValue={childCounts[l.idx] || ''}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        if (v !== (childCounts[l.idx] ?? 0)) void save({ childCounts: { ...childCounts, [l.idx]: v } });
                      }} />
                  )}
                </td>
                <td className="n">{fmt(l.allowed)}</td>
              </tr>
            ))}
            <tr className="tot"><td /><td>Jumlah pelepasan cukai</td><td /><td /><td className="n">{fmt(result.totalRelief)}</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="title" style={{ marginTop: 24 }}>Seksyen B : Pengiraan cukai</h3>
      <table className="stmt">
        <tbody>
          <tr className="h"><td>Anggaran pendapatan yang dikenakan cukai SEBELUM tolak zakat</td><td className="nt" /><td className="n">{fmt(result.chargeable)}</td></tr>
        </tbody>
      </table>
      <div className="tw">
        <table className="xl" style={{ maxWidth: 640, margin: '10px auto' }}>
          <thead><tr><th>Pendapatan Bercukai</th><th className="n">Kadar (%)</th><th className="n">Nilai (RM)</th></tr></thead>
          <tbody>
            {result.bandRows.map((r, i) => (
              <tr key={i}><td>RM{rm0(r.from)} – RM{rm0(r.to)}</td><td className="n">{r.ratePct}</td><td className="n">{fmt(r.tax)}</td></tr>
            ))}
            <tr className="tot"><td>Cukai yang dikenakan</td><td /><td className="n">{fmt(result.tax)}</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="title" style={{ marginTop: 24 }}>Seksyen C : Rebat Zakat</h3>
      <table className="stmt">
        <tbody>
          <tr className="h"><td>CUKAI YANG DIKENAKAN</td><td className="nt" /><td className="n">{fmt(result.tax)}</td></tr>
          <tr>
            <td>(-) Zakat dan fitrah yang sudah dibayar</td><td className="nt" />
            <td className="n">
              <input className="inp" aria-label="Zakat already paid" disabled={locked} defaultValue={senToInput(result.zakatPaid)}
                onBlur={(e) => rmToSen(e.target.value) !== result.zakatPaid && save({ zakatPaid: rmToSen(e.target.value) })} />
            </td>
          </tr>
          <tr className="gt"><td>CUKAI YANG PERLU DIBAYAR</td><td className="nt" /><td className="n">{fmt(result.taxPayable)}</td></tr>
        </tbody>
      </table>
      <p className="note" style={{ textAlign: 'center' }}>{t('tax.disclaimer')}</p>
      {node}
    </div>
  );
}
