'use client';
import { useEffect, useState } from 'react';
import { SectionHead } from '@/components/public/bits';
import { Rulebook } from '@/components/public/Rulebook';
import { TERMS_BN, TERMS_EN, withMaxAge } from '@/content/terms';
import { useSnap } from '@/components/public/LiveProvider';

export default function RulesPage() {
  const [lang, setLang] = useState<'en' | 'bn'>('en');
  const maxAge = useSnap().settings.max_eligible_age ?? 24;
  useEffect(() => { if (window.location.hash === '#terms-bn') setLang('bn'); }, []);
  return (
    <>
      <SectionHead kicker="❄️ TRIVANTA EVENTS • OFFSIDE – HOME OF FOOTBALL" cyan="OFFICIAL" lime="RULEBOOK">
        <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.8rem', color: 'var(--lime)', fontWeight: 800, letterSpacing: '0.1em' }}>6-A-SIDE FORMAT · MAX 10 REGISTERED PLAYERS / TEAM</div>
      </SectionHead>
      <Rulebook />
      <div id="terms" style={{ marginTop: '2rem' }}>
        <SectionHead kicker="❄️ OFFICIAL REGISTRATION TERMS & CONDITIONS" cyan="TERMS &" lime="CONDITIONS" />
        <div className="ws-card lime-bottom">
          <div className="tabs-row">
            <button type="button" className={`filter-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}><span>ENGLISH</span></button>
            <button type="button" className={`filter-btn ${lang === 'bn' ? 'active' : ''}`} onClick={() => setLang('bn')}><span className="bn">বাংলা</span></button>
          </div>
          <div className="tc-body" lang={lang} dangerouslySetInnerHTML={{ __html: withMaxAge(lang === 'en' ? TERMS_EN : TERMS_BN, maxAge) }} />
        </div>
      </div>
    </>
  );
}
