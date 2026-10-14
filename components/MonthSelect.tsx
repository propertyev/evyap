'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MONTHS_LONG } from '@/lib/money';

export function MonthSelect({
  year, value, allowAll = false, label = 'Month',
}: { year: number; value: number | 'all'; allowAll?: boolean; label?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <>
      <label htmlFor="monthSel" style={{ margin: 0 }}>{label}</label>
      <select
        id="monthSel"
        value={String(value)}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set('m', e.target.value);
          router.replace(`${path}?${next.toString()}`);
        }}
      >
        {allowAll && <option value="all">All months {year}</option>}
        {MONTHS_LONG.map((m, i) => (
          <option key={m} value={i}>
            {m} {year}
          </option>
        ))}
      </select>
    </>
  );
}
