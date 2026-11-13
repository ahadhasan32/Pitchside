'use client';
// Official rulebook (sections 1–16), stage-duration table and points table — verbatim from design-v2.
const RULEBOOK_HTML = `<!-- Stage Duration Table (Section 2) & Group Points Table (Section 13) -->
        <div class="grid-2" style="margin-bottom:1.25rem;">
          <div class="ws-card lime-bottom">
            <div class="rule-sec-title"><span>2. MATCH DURATION & TIMEKEEPING</span><span class="badge-skew badge-ko">RUNNING CLOCK</span></div>
            <div class="table-scroll" style="margin-bottom:0.65rem;">
              <table class="ws-table" style="min-width:100%;">
                <thead>
                  <tr>
                    <th class="col-team">STAGE</th>
                    <th>ACTUAL PLAYING TIME</th>
                    <th>MAXIMUM ADDED TIME</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td class="col-team" style="color:#fff; font-weight:700;">Group Stage</td><td>10 minutes</td><td style="color:var(--lime);">Up to 2 minutes</td></tr>
                  <tr><td class="col-team" style="color:#fff; font-weight:700;">Semifinals</td><td>15 minutes</td><td style="color:var(--lime);">Up to 3 minutes</td></tr>
                  <tr><td class="col-team" style="color:#fff; font-weight:700;">Grand Final</td><td>20 minutes</td><td style="color:var(--lime);">Up to 4 minutes</td></tr>
                </tbody>
              </table>
            </div>
            <ul class="rule-list">
              <li>The match clock is treated as a running clock. The referee controls timekeeping and may add time for significant delays (injuries, deliberate time-wasting, disciplinary incidents, and video reviews).</li>
              <li>Added time is not automatic; the referee decides how much time is required up to the stage maximum.</li>
              <li>The referee's timekeeping decision is final, subject to any applicable video-review procedure.</li>
            </ul>
          </div>

          <div class="ws-card lime-bottom">
            <div class="rule-sec-title"><span>13. GROUP-STAGE POINTS & QUALIFICATION</span><span class="badge-skew badge-group-a">TOP 2 ADVANCE</span></div>
            <div class="table-scroll" style="margin-bottom:0.65rem;">
              <table class="ws-table" style="min-width:100%;">
                <thead>
                  <tr>
                    <th class="col-team">RESULT</th>
                    <th>POINTS AWARDED</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td class="col-team" style="color:#fff; font-weight:700;">Win</td><td class="pts-cell">3</td></tr>
                  <tr><td class="col-team" style="color:#fff; font-weight:700;">Draw</td><td class="pts-cell">1</td></tr>
                  <tr><td class="col-team" style="color:#fff; font-weight:700;">Loss</td><td class="pts-cell">0</td></tr>
                </tbody>
              </table>
            </div>
            <ul class="rule-list">
              <li>If teams are level on points, the order of tiebreakers is: <strong>(1) Goal difference</strong>, <strong>(2) Goals scored</strong>, <strong>(3) Head-to-head result</strong>, <strong>(4) Fair-play record</strong>, and <strong>(5) A tie-breaking procedure determined by the organisers</strong>.</li>
              <li>The top 2 teams in each group qualify for the semifinals.</li>
            </ul>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <div class="rule-section-card">
              <div class="rule-sec-title"><span>1. TOURNAMENT FORMAT</span></div>
              <ul class="rule-list">
                <li>Each team fields 6 players at a time, including one goalkeeper.</li>
                <li>Each team may register a maximum squad of 10 players.</li>
                <li>The tournament consists of 8 teams divided into 2 groups of 4.</li>
                <li>Each team plays the other teams in its group once. The top 2 teams from each group qualify for the semifinals.</li>
                <li>Semifinal 1: Group A winner vs Group B runner-up. Semifinal 2: Group B winner vs Group A runner-up.</li>
                <li>The semifinal winners advance to the Grand Final.</li>
              </ul>
            </div>

            <div class="rule-section-card">
              <div class="rule-sec-title"><span>3. STARTING AND RESTARTING PLAY</span></div>
              <div class="rule-subhead">3.1 Kick-Off</div>
              <ul class="rule-list">
                <li>Play begins with a kick-off from the centre mark. Opponents must remain the required distance away until the ball is in play.</li>
                <li>A goal cannot be scored directly from a kick-off. At least one other player must touch the ball before a goal can be scored.</li>
                <li>The ball is in play when it is kicked and clearly moves.</li>
              </ul>
              <div class="rule-subhead">3.2 Kick-Ins (No Throw-Ins)</div>
              <ul class="rule-list">
                <li>Traditional throw-ins are not used. Play restarts with a kick-in from the touchline where the ball left the field.</li>
                <li>Opponents must remain at least 4 normal steps from the ball. Must be taken within 4 seconds after ready.</li>
                <li>A goal cannot be scored directly from a kick-in (enters opponent goal = goal clearance; own goal = corner). Incorrect kick-in turnovers to opposing team.</li>
              </ul>
              <div class="rule-subhead">3.3 Goal Clearance & 3.4 Corner Kicks</div>
              <ul class="rule-list">
                <li><strong>Goal Clearance:</strong> Goalkeeper must release the ball within 4 seconds while in control of it in their own half.</li>
                <li><strong>Corner Kicks:</strong> Taken within 4 seconds; opponents at least 6 normal steps away. A goal <strong>may</strong> be scored directly from a corner kick.</li>
              </ul>
              <div class="rule-subhead">3.5 Ceiling or Overhead Obstruction</div>
              <ul class="rule-list">
                <li>If the ball hits the ceiling or an overhead obstruction, play stops and restarts with a dropped ball at a safe location determined by the referee.</li>
              </ul>
            </div>

            <div class="rule-section-card">
              <div class="rule-sec-title"><span>4. GOALS & OFFSIDE · 5. GOALKEEPER RULES</span></div>
              <ul class="rule-list">
                <li><strong>No Offside:</strong> There is no offside rule in this tournament.</li>
                <li><strong>Goalkeeper Handling:</strong> Hands permitted only inside own penalty area. May not control the ball in own half for more than 4 seconds.</li>
                <li><strong>Back-Passes:</strong> Back passes to the goalkeeper are allowed.</li>
                <li><strong>GK Change & Tie-Breaker Rule:</strong> Change of goalkeeper during a match is permissible. However, if the match goes to a tie-breaker, <strong>the goalkeeper on the field at the end of normal time must play the penalties</strong>.</li>
              </ul>
            </div>

            <div class="rule-section-card">
              <div class="rule-sec-title"><span>6. FOULS, FREE KICKS & PENALTIES · 7. HANDBALL</span></div>
              <ul class="rule-list">
                <li><strong>Free-Kick Distance:</strong> Opponents must remain at least 6 normal steps from the ball.</li>
                <li><strong>Handball Policy (§7):</strong> Under this tournament's stricter disciplinary policy, <strong>deliberate handball results in a yellow card</strong> in addition to the restart (or a <strong>red card</strong> if it denies an obvious goal-scoring opportunity).</li>
              </ul>
            </div>

            <div class="rule-section-card">
              <div class="rule-sec-title"><span>8. SLIDE TACKLES · 9. SUBSTITUTIONS</span></div>
              <ul class="rule-list">
                <li><strong>Slide Tackles (§8):</strong> Permitted provided the challenge is a genuine and fair attempt to play the ball. Contact with the opponent's body before the ball is a foul; careless/reckless/excessive-force tackles are penalised even if the ball is touched first.</li>
                <li><strong>Rolling Substitutions (§9):</strong> Unlimited rolling substitutions permitted only when the ball is out of play and the referee has stopped play, supervised by the assistant referee. Player leaving must completely exit before substitute enters. Illegal entry = indirect free kick and potential yellow card.</li>
              </ul>
            </div>
          </div>

          <div>
            <div class="rule-section-card">
              <div class="rule-sec-title"><span>10. PLAYER DISCIPLINE & RESPECT</span></div>
              <div class="rule-subhead">10.1 Respect for the Referee</div>
              <ul class="rule-list">
                <li>Only the team captain or designated representative may respectfully request clarification from the referee. Dissent may result in a free kick, yellow card, or further action.</li>
              </ul>
              <div class="rule-subhead">10.2 Abusive Language & Fighting</div>
              <ul class="rule-list">
                <li><strong>Abusive/Insulting Language:</strong> Direct red card + suspended from the team's next match.</li>
                <li><strong>Fighting / Physical Violence:</strong> Direct red card + <strong>expulsion from the entire tournament</strong>. The team must continue without that player and may not register a replacement.</li>
              </ul>
              <div class="rule-subhead">10.3 Yellow & Red Cards</div>
              <ul class="rule-list">
                <li>A red-carded player must leave the field and technical area and is suspended for at least the team's next match (or expelled for the tournament for fighting).</li>
              </ul>
            </div>

            <div class="rule-section-card">
              <div class="rule-sec-title"><span>11. VIDEO REVIEW (VAR APPEALS)</span></div>
              <ul class="rule-list">
                <li>Each team has a maximum of <strong>2 video-review appeals per match</strong> (requested only by the team captain or designated representative before play restarts).</li>
                <li>Every appeal is counted and consumed whether the original decision is upheld, changed, or overturned.</li>
                <li>The on-field referee may independently request a review at any time without consuming either team's appeal.</li>
                <li>For a formally reviewed incident, the video referee's decision is final.</li>
              </ul>
            </div>

            <div class="rule-section-card">
              <div class="rule-sec-title"><span>12. ATTENDANCE & MINIMUM PLAYERS</span></div>
              <ul class="rule-list">
                <li><strong>Walkover:</strong> Teams must be present, checked in, and ready at scheduled kick-off time, or the opposing team is awarded a walkover.</li>
                <li><strong>Minimum 3 Players:</strong> A team arriving with fewer than 6 players must still play provided it has at least <strong>3 players (including the goalkeeper)</strong>. Falling below 3 players during a match requires the referee to abandon the match.</li>
              </ul>
            </div>

            <div class="rule-section-card">
              <div class="rule-sec-title"><span>14. KNOCKOUT MATCHES & PENALTY SHOOTOUTS</span></div>
              <ul class="rule-list">
                <li>Semifinals and the Grand Final must produce a winner. There is no extra-time period.</li>
                <li>If tied at the end of normal + added time, the winner is decided by a penalty shootout: <strong>each team takes 4 penalty kicks</strong> alternating.</li>
                <li>If still level after 4 kicks per team, the shootout proceeds to <strong>sudden death</strong> (one kick each per round).</li>
              </ul>
            </div>

            <div class="rule-section-card">
              <div class="rule-sec-title"><span>15. ABANDONED MATCHES · 16. ACCEPTANCE</span></div>
              <ul class="rule-list">
                <li>The referee may suspend or abandon a match for serious misconduct, safety risk, interference, or violence. A team refusing to continue may forfeit.</li>
                <li>By participating in Winter Showdown 2026, each team and registered player agrees to follow this rulebook and respect the referees and TRIVANTA EVENTS organisers.</li>
              </ul>
            </div>
          </div>
        </div>`;
export function Rulebook() {
  return <div dangerouslySetInnerHTML={{ __html: RULEBOOK_HTML }} />;
}
