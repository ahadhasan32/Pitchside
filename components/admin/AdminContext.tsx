'use client';
import { createContext, useCallback, useContext, useState } from 'react';

export type Role = 'owner' | 'scorer' | 'viewer';
type Toast = { id: number; text: string; bad?: boolean };
type Ctx = { role: Role; email: string; userId: string; can: (r: Role) => boolean; toast: (text: string, bad?: boolean) => void };
const AdminCtx = createContext<Ctx | null>(null);
const RANK: Record<Role, number> = { owner: 3, scorer: 2, viewer: 1 };

export function AdminProvider({ role, email, userId, children }: { role: Role; email: string; userId: string; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((text: string, bad = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, bad }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), bad ? 6000 : 2600);
  }, []);
  const can = useCallback((r: Role) => RANK[role] >= RANK[r], [role]);
  return (
    <AdminCtx.Provider value={{ role, email, userId, can, toast }}>
      {children}
      <div className="toast-container" style={{ display: 'flex' }}>
        {toasts.map((t) => (
          <div key={t.id} className="toast-msg" style={t.bad ? { borderColor: 'var(--danger)', color: '#FF8FA3' } : undefined}>{t.text}</div>
        ))}
      </div>
    </AdminCtx.Provider>
  );
}
export function useAdmin(): Ctx {
  const c = useContext(AdminCtx);
  if (!c) throw new Error('useAdmin outside AdminProvider');
  return c;
}

/** Turn Postgres RPC errors ("CODE: message") into something readable. */
export function errText(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const m = msg.match(/^[A-Z_]+: (.*)$/s);
  return m ? m[1] : msg;
}
