'use client';
import { useState } from 'react';

type Ask = { title: string; body: React.ReactNode; confirmLabel?: string; danger?: boolean; resolve: (ok: boolean) => void };
let push: ((a: Ask) => void) | null = null;

/** Promise-based confirmation modal: `if (await confirmDialog({...})) ...` */
export function confirmDialog(o: Omit<Ask, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => (push ? push({ ...o, resolve }) : resolve(window.confirm(String(o.title)))));
}

export function ConfirmHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  push = setAsk;
  if (!ask) return null;
  const close = (ok: boolean) => { ask.resolve(ok); setAsk(null); };
  return (
    <div className="modal-backdrop open" style={{ display: 'flex' }} role="dialog" aria-modal="true">
      <div className="modal-panel" style={{ maxWidth: 460 }}>
        <div className="modal-header"><div className="modal-title">⚠️ {ask.title}</div><button type="button" className="close-btn" onClick={() => close(false)}>×</button></div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-soft)', marginBottom: '1.15rem' }}>{ask.body}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button type="button" className="btn-skew btn-cyan-outline" onClick={() => close(false)}><span>CANCEL</span></button>
          <button type="button" className={`btn-skew ${ask.danger ? 'btn-danger-outline' : 'btn-lime'}`} onClick={() => close(true)} autoFocus><span>{ask.confirmLabel ?? 'CONFIRM'}</span></button>
        </div>
      </div>
    </div>
  );
}
