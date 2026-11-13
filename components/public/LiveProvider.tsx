'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { loadSnapshot } from '@/lib/data';
import type { Snapshot } from '@/lib/types';

type Ctx = { snap: Snapshot; connected: boolean; refresh: () => Promise<void> };
const LiveCtx = createContext<Ctx | null>(null);

const TABLES = ['matches', 'match_events', 'player_match_ratings', 'match_lineups', 'teams', 'players', 'settings', 'awards', 'tournaments'];

/**
 * Holds the tournament snapshot and keeps it fresh:
 *  - Supabase Realtime (postgres_changes) → debounced refetch
 *  - refetch on reconnect, tab focus/visibility and a slow interval fallback
 * All state comes from the DB, so reopening the browser always shows the truth.
 */
export function LiveProvider({ initial, children, pollMs = 30000 }: { initial: Snapshot; children: React.ReactNode; pollMs?: number }) {
  const [snap, setSnap] = useState(initial);
  const [connected, setConnected] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    try {
      const next = await loadSnapshot(supabaseBrowser(), initial.tournament.slug);
      setSnap(next);
    } catch (e) {
      console.warn('refresh failed', e);
    } finally {
      inflight.current = false;
      if (again.current) { again.current = false; void refresh(); }
    }
  }, [initial.tournament.slug]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), 250);
  }, [refresh]);

  useEffect(() => {
    const sb = supabaseBrowser();
    let wasDown = false;
    let ch = sb.channel('ws-live-' + Math.random().toString(36).slice(2));
    for (const t of TABLES) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, schedule);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        if (wasDown) { wasDown = false; schedule(); }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        wasDown = true;
        setConnected(false);
      }
    });
    const onFocus = () => { if (document.visibilityState === 'visible') schedule(); };
    const onOnline = () => schedule();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    const iv = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, pollMs);
    // initial client refresh: SSR data may be a few seconds old
    schedule();
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      clearInterval(iv);
      if (timer.current) clearTimeout(timer.current);
      void sb.removeChannel(ch);
    };
  }, [schedule, refresh, pollMs]);

  const value = useMemo(() => ({ snap, connected, refresh }), [snap, connected, refresh]);
  return (
    <LiveCtx.Provider value={value}>
      {children}
      {!connected && <div className="reconnect-pill">● RECONNECTING…</div>}
    </LiveCtx.Provider>
  );
}

export function useLive(): Ctx {
  const c = useContext(LiveCtx);
  if (!c) throw new Error('useLive outside LiveProvider');
  return c;
}
export const useSnap = () => useLive().snap;
