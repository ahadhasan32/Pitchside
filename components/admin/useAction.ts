'use client';
import { useCallback, useRef, useState } from 'react';
import { useLive } from '@/components/public/LiveProvider';
import { useAdmin, errText } from './AdminContext';

/** Runs a write with a busy flag (buttons disable), toasts, and an immediate refresh. Ignores re-entrant double clicks. */
export function useAction() {
  const { refresh } = useLive();
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(async (fn: () => PromiseLike<{ error: unknown } | void> | Promise<unknown>, okMsg?: string): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true; setBusy(true);
    try {
      const res = (await fn()) as { error?: unknown } | undefined;
      if (res && res.error) throw res.error;
      if (okMsg) toast(okMsg);
      return true;
    } catch (e) {
      toast(errText(e), true);
      return false;
    } finally {
      lock.current = false; setBusy(false);
      void refresh();
    }
  }, [refresh, toast]);
  return { busy, run };
}
