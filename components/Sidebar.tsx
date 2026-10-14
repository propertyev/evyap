'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { t } from '@/lib/i18n';

export function Sidebar({
  companyName, ssmNo, year, logoUrl,
}: { companyName: string; ssmNo: string; year: number; logoUrl: string }) {
  const path = usePathname();
  const on = (href: string) => path === href || path.startsWith(href + '/');
  return (
    <aside className="side" aria-label="Main menu">
      <div className="brand">
        <span className="menu">MENU</span>
        <span className="mark" aria-label="EVyap">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={companyName} />
          ) : (
            <>
              <i>E</i>Vy<span>ap</span>
            </>
          )}
        </span>
      </div>
      <Link href="/dashboard" className={`dashbtn${on('/dashboard') ? ' on' : ''}`}>
        <i>⌂</i>
        {t('menu.dashboard')}
      </Link>
      <nav>
        {NAV.map((item, i) =>
          item === 'gap' ? (
            <div className="gap" key={`g${i}`} />
          ) : (
            <Link key={item.key} href={item.href} className={`mb${on(item.href) ? ' on' : ''}`}>
              <i aria-hidden>{item.icon}</i>
              {t(item.label)}
            </Link>
          ),
        )}
        <a href={`/api/export/excel?year=${year}`} className="mb" download>
          <i aria-hidden>⤓</i>
          {t('menu.export')}
        </a>
      </nav>
      <div className="co">
        {companyName}
        {ssmNo ? ` · SSM ${ssmNo}` : ''} · FY{year}
      </div>
    </aside>
  );
}
