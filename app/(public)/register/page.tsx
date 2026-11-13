'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { SectionHead } from '@/components/public/bits';
import { supabaseBrowser } from '@/lib/supabase/client';

// Only usable when an owner reopens registration (Settings). Inserts go to registration_submissions:
// insert-only for the public (RLS), rate-limited, never auto-confirmed.
export default function RegisterPage() {
  const snap = useSnap();
  const [f, setF] = useState({ team: '', phone: '', trx: '', players: '', agree: false });
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle');
  if (!snap.settings.registration_open) {
    return (
      <div className="ws-card reg-closed">
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--lime)' }}>REGISTRATION CLOSED — TOURNAMENT IN PROGRESS</h2>
        <p style={{ color: 'var(--text-soft)', margin: '0.6rem 0 1rem' }}>All squads are locked in for Winter Showdown 2026.</p>
        <Link href="/fixtures" className="btn-skew btn-lime"><span>⚽ LIVE RESULTS</span></Link>
      </div>
    );
  }
  if (state === 'done') return <div className="ws-card reg-closed"><h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--lime)' }}>SUBMITTED ✓</h2><p style={{ color: 'var(--text-soft)' }}>The organisers will review your registration and contact you. It is not confirmed until approved.</p></div>;
  return (
    <>
      <SectionHead kicker="❄️ NEXT EDITION" cyan="TEAM" lime="REGISTRATION" />
      <form className="ws-card lime-bottom" style={{ display: 'grid', gap: '0.7rem', maxWidth: 640 }} onSubmit={async (e) => {
        e.preventDefault();
        if (!f.agree) return setState('Please accept the Terms & Conditions.');
        if (f.team.trim().length < 2 || !/^\+?\d[\d\s-]{9,15}$/.test(f.phone.trim())) return setState('Enter a team name and a valid phone number.');
        setState('busy');
        const { error } = await supabaseBrowser().from('registration_submissions').insert({ tournament_id: snap.tournament.id, payload: { team: f.team.trim().slice(0, 80), phone: f.phone.trim(), trx: f.trx.trim().slice(0, 40), players: f.players.trim().slice(0, 4000), terms: true } });
        setState(error ? error.message : 'done');
      }}>
        <div><label className="form-label">TEAM NAME</label><input className="form-input" maxLength={80} value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} /></div>
        <div><label className="form-label">TEAM PHONE</label><input className="form-input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="form-label">BKASH TRXID</label><input className="form-input" maxLength={40} value={f.trx} onChange={(e) => setF({ ...f, trx: e.target.value })} /></div>
        <div><label className="form-label">PLAYERS (ONE PER LINE: NAME, POSITION, AGE)</label><textarea className="form-input" rows={8} maxLength={4000} value={f.players} onChange={(e) => setF({ ...f, players: e.target.value })} /></div>
        <label style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}><input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} /> I accept the <Link href="/rules#terms" style={{ color: 'var(--cyan)' }}>Terms & Conditions</Link>.</label>
        {state !== 'idle' && state !== 'busy' && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{state}</div>}
        <button className="btn-skew btn-lime" disabled={state === 'busy'} style={{ justifySelf: 'start' }}><span>SUBMIT REGISTRATION</span></button>
      </form>
    </>
  );
}
