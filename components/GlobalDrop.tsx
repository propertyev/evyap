'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { setPendingFiles } from '@/lib/pending-files';

/** Accepts a file dropped anywhere in the app (outside the Import page) and jumps to Import. */
export function GlobalDrop() {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (path.startsWith('/import')) return;
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setPendingFiles([...e.dataTransfer.files]);
      router.push('/import');
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [path, router]);
  return null;
}
