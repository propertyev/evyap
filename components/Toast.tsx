'use client';

import { useCallback, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const show = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), kind === 'err' ? 7000 : 4000);
  }, []);
  const node = toast ? (
    <div className={`toast ${toast.kind}`} role={toast.kind === 'err' ? 'alert' : 'status'}>
      {toast.msg}
    </div>
  ) : null;
  return { show, node };
}
