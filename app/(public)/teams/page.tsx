'use client';
import { useMemo, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { BigLogo, SectionHead, TeamCrest } from '@/components/public/bits';
import { computePlayerStats, computeSuspensions, teamOverall } from '@/lib/tournament';

const POS: Record<string, string> = { goalkeeper: 'GK', defender: 'DEFENDER', midfielder: 'MIDFIELDER', striker: 'STRIKER' };

export default function TeamsPage() {
  const snap = useSnap();
  const teams = [...snap.teams].filter((t) => t.status !== 'withdrawn').sort((a, b) => (snap.groups.find((g) => g.id === a.group_id)?.code ?? '').localeCompare(snap.groups.find((g) => g.id === b.group_id)?.code ?? '') || a.display_name.localeCompare(b.display_name));
  const [sel, setSel] = useState(teams[0]?.id);
  const stats = useMemo(() => computePlayerStats(snap), [snap]);
  const susp = computeSuspensions(snap);
  const active = snap.teams.find((t) => t.id === sel) ?? teams[0];
  const code = (gid: string | null) => snap.groups.find((g) => g.id === gid)?.code ?? '?';
  if (!active) return null;
  const squad = snap.players.filter((p) => p.team_id === active.id && p.active).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
  return (
    <>
      <SectionHead kicker={`❄️ ${snap.teams.length} OFFICIAL CHALLENGERS (RULEBOOK §1: MAX 10 PLAYERS / TEAM)`} cyan="THE" lime="CHALLENGERS" />
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        {teams.map((t) => {
          const o = teamOverall(snap, t.id);
          const n = snap.players.filter((p) => p.team_id === t.id && p.active).length;
          const on = t.id === active.id;
          return (
            <button type="button" key={t.id} className="ws-card chamfer" onClick={() => setSel(t.id)} style={{ cursor: 'pointer', textAlign: 'left', color: 'inherit', borderColor: on ? 'var(--lime)' : 'var(--cyan-soft)', boxShadow: on ? '0 0 20px var(--lime-glow)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <span className={`badge-skew ${code(t.group_id) === 'A' ? 'badge-group-a' : 'badge-group-b'}`}>GROUP {code(t.group_id)}</span>
                <div className="form-chips">{[0, 1, 2].map((i) => (o.form[i] ? <span key={i} className={`form-chip form-${o.form[i]}`}>{o.form[i]}</span> : <span key={i} className="form-chip form-empty">-</span>))}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem' }}>
                <TeamCrest team={t} size={42} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#fff' }}>{t.display_name}</div>
                  {t.name !== t.display_name && <div className="bn" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.name}</div>}
                  <div style={{ fontSize: '0.74rem', color: n >= 10 ? 'var(--lime)' : 'var(--text-muted)' }}>{n} / 10 players registered</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', textAlign: 'center', background: 'rgba(13,42,108,0.65)', padding: '0.4rem', borderRadius: 6, fontSize: '0.74rem' }}>
                <div><div style={{ color: 'var(--text-muted)' }}>P</div><div style={{ color: '#fff', fontWeight: 700 }}>{o.P}</div></div>
                <div><div style={{ color: 'var(--text-muted)' }}>W-D-L</div><div style={{ color: '#fff', fontWeight: 700 }}>{o.W}-{o.D}-{o.L}</div></div>
                <div><div style={{ color: 'var(--text-muted)' }}>GF:GA</div><div style={{ color: '#fff', fontWeight: 700 }}>{o.GF}:{o.GA}</div></div>
                <div><div style={{ color: 'var(--text-muted)' }}>CS</div><div style={{ color: 'var(--lime)', fontWeight: 700 }}>{o.cleanSheets}</div></div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="ws-card lime-bottom">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <BigLogo team={active} size={56} />
          <div>
            <span className={`badge-skew ${code(active.group_id) === 'A' ? 'badge-group-a' : 'badge-group-b'}`}>GROUP {code(active.group_id)} ROSTER ({squad.length}/10 MAX)</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: '#fff', marginTop: '0.2rem' }}>{active.display_name}</h3>
          </div>
        </div>
        <div className="table-scroll">
          <table className="ws-table" style={{ minWidth: '100%' }}>
            <thead><tr><th>#</th><th className="col-team">PLAYER</th><th>ROLE</th><th>MP</th><th>G</th><th>A</th><th>CARDS / STATUS</th></tr></thead>
            <tbody>
              {squad.map((p) => {
                const s = stats.find((x) => x.player.id === p.id)!;
                const su = susp.get(p.id);
                return (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--font-display)', color: 'var(--lime)' }}>{p.jersey ?? '–'}</td>
                    <td className="col-team" style={{ color: '#fff', fontWeight: 700 }}>{p.name}{active.captain_player_id === p.id && <span style={{ color: 'var(--gold)' }}> (C)</span>}</td>
                    <td><span className="badge-skew badge-group-a">{POS[p.position]}</span></td>
                    <td>{s.played}</td>
                    <td className="pts-cell">{s.goals}</td>
                    <td>{s.assists}</td>
                    <td>{s.yellow ? `🟨${s.yellow} ` : ''}{s.red ? `🟥${s.red} ` : ''}{su?.kind === 'expelled' && <span className="mini-tag tag-exp">EXPELLED</span>}{su?.kind === 'suspended' && su.active && <span className="mini-tag tag-susp">SUSPENDED</span>}{!s.yellow && !s.red && !su && <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
