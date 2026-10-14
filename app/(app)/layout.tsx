import { GlobalDrop } from '@/components/GlobalDrop';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { LockedBanner } from '@/components/ui';
import { getPage } from '@/lib/page';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const p = await getPage();
  return (
    <div className="app">
      <Sidebar companyName={p.company.name} ssmNo={p.company.ssmNo} year={p.year} logoUrl={p.company.logoUrl} />
      <main className="main">
        <TopBar year={p.year} years={p.years} locked={p.locked} userName={p.user.name} role={p.ctx.role} />
        <LockedBanner locked={p.locked} />
        {children}
      </main>
      <GlobalDrop />
    </div>
  );
}
