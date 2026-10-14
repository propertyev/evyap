'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { apiFetch } from '@/lib/client';

export function TopBar({
  year, years, locked, userName, role,
}: { year: number; years: number[]; locked: boolean; userName: string; role: string }) {
  const router = useRouter();
  async function setYear(y: number) {
    await apiFetch('/api/year', { body: { year: y } });
    router.refresh();
  }
  async function addYear() {
    const y = Number(prompt('New financial year (e.g. 2027)?'));
    if (y >= 1990 && y <= 2100) await setYear(y);
  }
  return (
    <div className="topbar">
      <label htmlFor="yearSel" style={{ margin: 0 }}>Year</label>
      <select id="yearSel" value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <button className="btn sm" onClick={addYear} type="button">+ Year</button>
      {locked && <span className="lock" style={{ margin: 0, padding: '2px 8px' }}>🔒 Year closed</span>}
      <span className="note">
        {userName} · {role}
      </span>
      <button className="btn sm" type="button" onClick={() => signOut({ callbackUrl: '/login' })}>
        Sign out
      </button>
    </div>
  );
}
