/**
 * SimulationApp: Main Controller linking UI, SimulatorEngine, and GraphVisualizer.
 */

class SimulationApp {
  constructor() {
    this.dataSource = 'synthetic'; // 'synthetic' or pool_id 'public_01'...'public_10'
    this.seed = 101;
    this.variant = 'development';
    this.policyMode = 'submission';
    this.speed = 2; // speed multiplier
    this.isPlaying = false;
    this.playTimer = null;

    this.sim = null;
    this.policy = null;
    this.visualizer = null;
    this.selectedMember = null;
    this.eventsHistory = [];

    this.initDOM();
    this.initSimulation();
    this.initVisualizer();
    this.bindEvents();
    this.updateUI();

    // Start visualizer render loop
    const renderLoop = () => {
      if (this.visualizer) {
        this.visualizer.render();
      }
      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);
  }

  initDOM() {
    this.dom = {
      canvas: document.getElementById('simCanvas'),
      tooltip: document.getElementById('simTooltip'),
      btnPlay: document.getElementById('btnPlay'),
      btnStep: document.getElementById('btnStep'),
      btnFastForward: document.getElementById('btnFastForward'),
      btnReset: document.getElementById('btnReset'),
      selectDataset: document.getElementById('selectDataset'),
      selectVariant: document.getElementById('selectVariant'),
      labelVariant: document.getElementById('labelVariant'),
      selectPolicy: document.getElementById('selectPolicy'),
      inputSeed: document.getElementById('inputSeed'),
      labelSeed: document.getElementById('labelSeed'),
      sliderSpeed: document.getElementById('sliderSpeed'),
      speedLabel: document.getElementById('speedLabel'),

      // Metric elements
      dayIndicator: document.getElementById('dayIndicator'),
      valMsmiScore: document.getElementById('valMsmiScore'),
      valMsmiTotal: document.getElementById('valMsmiTotal'),
      valMutualAccept: document.getElementById('valMutualAccept'),
      valMutualPer100: document.getElementById('valMutualPer100'),
      valCoveragePct: document.getElementById('valCoveragePct'),
      valCoverageRatio: document.getElementById('valCoverageRatio'),
      valDatesCount: document.getElementById('valDatesCount'),
      valAskBudgetRemaining: document.getElementById('valAskBudgetRemaining'),
      valAskCostTotal: document.getElementById('valAskCostTotal'),
      budgetBarFill: document.getElementById('budgetBarFill'),

      // Panels & tabs
      tabs: document.querySelectorAll('.tab-btn'),
      tabContents: document.querySelectorAll('.tab-content'),
      inspectorContent: document.getElementById('inspectorContent'),
      eventFeed: document.getElementById('eventFeed'),
      funnelArrived: document.getElementById('funnelArrived'),
      funnelServed: document.getElementById('funnelServed'),
      funnelMutual: document.getElementById('funnelMutual'),
      funnelDates: document.getElementById('funnelDates'),
      funnelMsmi: document.getElementById('funnelMsmi'),
      barServed: document.getElementById('barServed'),
      barMutual: document.getElementById('barMutual'),
      barDates: document.getElementById('barDates'),
      barMsmi: document.getElementById('barMsmi'),
    };
  }

  initSimulation() {
    if (this.dataSource === 'synthetic') {
      const world = window.SimulationEngine.generateWorld(this.seed, 200, 'dev_01', this.variant);
      this.sim = new window.SimulationEngine.SimulationEnvironment(world);
      this.addEventLog('system', 'Episode Initialized', `World generated with Seed ${this.seed}, Variant: ${this.variant} (200 Synthetic Adults).`);
    } else {
      const datasetState = (window.OFFICIAL_DATASETS || {})[this.dataSource];
      if (datasetState) {
        this.sim = window.SimulationEngine.SimulationEnvironment.fromDataset(datasetState);
        this.addEventLog('system', 'Official Dataset Loaded', `Loaded official pool ${this.dataSource.toUpperCase()} (${datasetState.split.toUpperCase()} Split · Day 30 Snapshot · 200 Members).`);
      } else {
        const world = window.SimulationEngine.generateWorld(this.seed, 200, 'dev_01', this.variant);
        this.sim = new window.SimulationEngine.SimulationEnvironment(world);
      }
    }
    this.policy = new window.SimulationEngine.PolicyRunner();
    this.eventsHistory = [];
    this.selectedMember = null;
  }

  initVisualizer() {
    this.visualizer = new window.GraphVisualizer(this.dom.canvas, {
      onNodeClick: (member) => this.selectMember(member),
      onNodeHover: (member, screenX, screenY) => this.showTooltip(member, screenX, screenY)
    });
    this.updateVisualizer();
  }

  bindEvents() {
    this.dom.btnPlay.addEventListener('click', () => this.togglePlay());
    this.dom.btnStep.addEventListener('click', () => {
      if (this.sim.day >= 100) {
        this.reset();
        this.step();
      } else {
        this.step();
      }
    });
    this.dom.btnFastForward.addEventListener('click', () => this.fastForward());
    this.dom.btnReset.addEventListener('click', () => this.reset());

    this.dom.selectDataset.addEventListener('change', (e) => {
      this.dataSource = e.target.value;
      const isDataset = this.dataSource !== 'synthetic';
      this.dom.selectVariant.style.display = isDataset ? 'none' : 'inline-block';
      this.dom.labelVariant.style.display = isDataset ? 'none' : 'inline-block';
      this.dom.inputSeed.style.display = isDataset ? 'none' : 'inline-block';
      this.dom.labelSeed.style.display = isDataset ? 'none' : 'inline-block';
      this.reset();
    });

    this.dom.selectVariant.addEventListener('change', (e) => {
      this.variant = e.target.value;
      this.reset();
    });

    this.dom.selectPolicy.addEventListener('change', (e) => {
      this.policyMode = e.target.value;
      this.addEventLog('system', 'Policy Switched', `Active strategy set to: ${e.target.options[e.target.selectedIndex].text}`);
    });

    this.dom.inputSeed.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val)) {
        this.seed = val;
        this.reset();
      }
    });

    this.dom.sliderSpeed.addEventListener('input', (e) => {
      this.speed = parseFloat(e.target.value);
      this.dom.speedLabel.textContent = `${this.speed}x`;
      if (this.isPlaying) {
        this.pause();
        this.play();
      }
    });

    // Tab buttons
    this.dom.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.tabs.forEach(b => b.classList.remove('active'));
        this.dom.tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
      });
    });
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.sim.day >= 100) {
      this.reset();
    }
    this.isPlaying = true;
    this.dom.btnPlay.innerHTML = `<span>⏸</span> Pause Season`;
    this.dom.btnPlay.classList.add('btn-crimson');
    this.dom.btnPlay.classList.remove('btn-ink');

    const interval = Math.max(40, 1100 / this.speed);
    this.playTimer = setInterval(() => {
      if (!this.step()) {
        this.pause();
      }
    }, interval);
  }

  pause() {
    this.isPlaying = false;
    this.dom.btnPlay.innerHTML = `<span>▶</span> Conduct Season`;
    this.dom.btnPlay.classList.remove('btn-crimson');
    this.dom.btnPlay.classList.add('btn-ink');
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  reset() {
    this.pause();
    this.initSimulation();
    this.updateVisualizer();
    this.updateUI();
  }

  fastForward() {
    this.pause();
    if (this.sim.day >= 100) {
      this.reset();
    }
    this.addEventLog('system', 'Fast-Forward', 'Simulating all days rapidly to Day 100...');
    while (this.sim.day < 100) {
      this.step();
    }
    this.updateVisualizer();
    this.updateUI();
  }

  step() {
    if (this.sim.day >= 100) {
      this.addEventLog('system', 'Episode Completed', `Reached follow-up day 100. Final MSMI: ${this.sim.getMetrics().msmi}`);
      return false;
    }

    const currentDay = this.sim.day;
    const isDecisionWindow = currentDay < 60;

    let asksToExecute = [];
    let pairsToExecute = [];

    if (isDecisionWindow) {
      const observation = this.sim.observe();

      if (this.policyMode !== 'manual') {
        const decisions = this.policy.decide(observation, this.policyMode);
        asksToExecute = decisions.asks || [];
        pairsToExecute = decisions.pairs || [];
      }

      // Execute Asks
      if (asksToExecute.length > 0) {
        const resolved = this.sim.resolveAsks(asksToExecute);
        for (const item of resolved) {
          const m = this.sim.members[item.member_id];
          const desc = item.field === 'constraints'
            ? `Bundle unlocked for ${m.member_id} (${m.age}${m.gender[0].toUpperCase()}, ${m.zone})`
            : `Soft field '${item.field}' clarified for ${m.member_id}`;
          this.addEventLog('ask', `Day ${currentDay} Clarification`, desc);
        }
      }
    }

    // Execute Pairs and advance day
    const validPairs = this.sim.advance(pairsToExecute);
    for (const [u, v] of validPairs) {
      const ma = this.sim.members[u];
      const mb = this.sim.members[v];
      this.addEventLog('match', `Day ${currentDay} Introduction`, `Paired ${u} (${ma.age}${ma.gender[0].toUpperCase()}) ⇄ ${v} (${mb.age}${mb.gender[0].toUpperCase()}) in ${ma.zone}`);
    }

    // Check newly revealed feedback events
    const feedback = this.sim.receiveFeedback();
    const todayEvents = feedback.filter(e => e.observed_day === currentDay + 1);
    for (const e of todayEvents) {
      if (e.event === 'introduction_response' && e.value === 'yes') {
        this.addEventLog('match', `Day ${currentDay + 1} Response`, `Member ${e.member_id} accepted introduction proposal!`);
      } else if (e.event === 'date_happened' && e.value === true) {
        this.addEventLog('date', `Day ${currentDay + 1} Date Event`, `Date successfully took place for intro ${e.introduction_id.slice(-6)}!`);
      } else if (e.event === 'second_meeting_intention' && e.value === 'yes') {
        this.addEventLog('msmi', `Day ${currentDay + 1} MSMI YES!`, `Second meeting intention confirmed by ${e.member_id}! 💖`);
      }
    }

    this.updateVisualizer();
    this.updateUI();
    return true;
  }

  updateVisualizer() {
    const observation = this.sim.observe();
    const activeIntros = this.sim.introductions.filter(i => {
      return this.sim.busy[i.user_a] > this.sim.day || this.sim.busy[i.user_b] > this.sim.day;
    }).map(i => [i.user_a, i.user_b]);

    this.visualizer.updateData(observation.members, this.sim.day, activeIntros, this.sim.past);
  }

  updateUI() {
    const metrics = this.sim.getMetrics();

    // Day status
    let phaseLabel = metrics.day < 60 ? 'Active Decision Phase' : 'Observation Follow-up';
    if (this.sim.isDataset) {
      phaseLabel = `Official Pool: ${this.sim.pool_id.toUpperCase()} (${(this.sim.split || 'train').toUpperCase()})`;
    }
    this.dom.dayIndicator.textContent = `Day ${metrics.day} / 60 (+40) · ${phaseLabel}`;

    // Metrics cards
    this.dom.valMsmiScore.textContent = metrics.msmi_per_100.toFixed(2);
    this.dom.valMsmiTotal.textContent = `${metrics.msmi} pairs achieved MSMI`;

    this.dom.valMutualAccept.textContent = `${metrics.mutual_acceptances}`;
    this.dom.valMutualPer100.textContent = `${metrics.mutual_acceptances_per_100.toFixed(1)} / 100 members`;

    this.dom.valCoveragePct.textContent = `${(metrics.coverage * 100).toFixed(1)}%`;
    this.dom.valCoverageRatio.textContent = `${metrics.served_members} / ${metrics.arrived_members} served`;

    this.dom.valDatesCount.textContent = `${metrics.dates}`;

    // Budget
    const remaining = 12 - metrics.ask_spent_today;
    this.dom.valAskBudgetRemaining.textContent = `${remaining} / 12`;
    this.dom.valAskCostTotal.textContent = `${metrics.ask_cost_total} units total spent`;
    this.dom.budgetBarFill.style.width = `${(remaining / 12) * 100}%`;

    // Funnel
    this.dom.funnelArrived.textContent = metrics.arrived_members;
    this.dom.funnelServed.textContent = metrics.served_members;
    this.dom.funnelMutual.textContent = metrics.mutual_acceptances;
    this.dom.funnelDates.textContent = metrics.dates;
    this.dom.funnelMsmi.textContent = metrics.msmi;

    const maxBase = Math.max(1, metrics.arrived_members);
    this.dom.barServed.style.width = `${(metrics.served_members / maxBase) * 100}%`;
    this.dom.barMutual.style.width = `${(metrics.mutual_acceptances / maxBase) * 100}%`;
    this.dom.barDates.style.width = `${(metrics.dates / maxBase) * 100}%`;
    this.dom.barMsmi.style.width = `${(metrics.msmi / maxBase) * 100}%`;

    if (this.selectedMember) {
      // Refresh inspector if open
      const liveMember = this.sim.members[this.selectedMember.member_id];
      if (liveMember) this.renderInspector(liveMember);
    }
  }

  selectMember(member) {
    this.selectedMember = member;
    // Switch to inspector tab automatically
    this.dom.tabs[0].click();
    this.renderInspector(member);
    this.visualizer.focusNode(member.member_id);
  }

  renderInspector(member) {
    const isAvailable = this.sim.isAvailable(member);
    let statusClass = 'pill-avail';
    let statusText = 'Available';
    if (member.exit_day <= this.sim.day) {
      statusClass = 'pill-exit';
      statusText = 'Exited Pool';
    } else if (this.sim.busy[member.member_id] > this.sim.day) {
      statusClass = 'pill-busy';
      statusText = `Busy (until day ${this.sim.busy[member.member_id]})`;
    } else if (!isAvailable) {
      statusClass = 'pill-busy';
      statusText = 'Unavailable';
    }

    // Find top partners
    const partners = [];
    const availableMembers = Object.values(this.sim.members).filter(m => this.sim.isAvailable(m) && m.member_id !== member.member_id);

    for (const other of availableMembers) {
      const pairKey = [member.member_id, other.member_id].sort().join('|');
      if (this.sim.past.has(pairKey)) continue;

      const elig = window.SimulationEngine.checkEligibility(member, other);
      if (elig.status === 'feasible') {
        const score = this.policy.scorePair(member, other, { day: this.sim.day });
        partners.push({ other, score, status: 'feasible' });
      } else if (elig.status === 'needs_clarification') {
        const score = this.policy.scorePair(member, other, { day: this.sim.day });
        partners.push({ other, score, status: 'needs_clarification' });
      }
    }

    partners.sort((a, b) => b.score - a.score);

    let html = `
      <div class="dossier-card">
        <div class="dossier-header">
          <div>
            <div class="dossier-name">${member.member_id}</div>
            <div class="dossier-meta">
              ${member.age} yrs · ${member.gender} · ${member.zone.toUpperCase()} · Arrived Day ${member.arrived_day}
            </div>
          </div>
          <span class="dossier-status-pill ${statusClass}">${statusText}</span>
        </div>

        <div class="kicker" style="margin-bottom: 6px;">ACTIONS & CLARIFICATIONS</div>
        <div style="display: flex; gap: 8px;">
          <button id="btnAskBundle" class="btn btn-ink" style="flex: 1; font-size: 10px; padding: 6px;" title="Clarify reciprocal hard constraints bundle (-3 units)">
            Ask Bundle (-3)
          </button>
          <button id="btnAskGoal" class="btn" style="flex: 1; font-size: 10px; padding: 6px;" title="Clarify primary soft goal (-1 unit)">
            Ask Goal (-1)
          </button>
        </div>
      </div>

      <div class="dossier-card">
        <div class="kicker" style="margin-bottom: 8px;">RECIPROCAL HARD CONSTRAINTS</div>
        <div class="field-grid">
    `;

    for (const k of window.SimulationEngine.HARD) {
      const val = member.fields[k];
      const stat = member.field_status[k];
      const displayVal = val === null ? '—' : (Array.isArray(val) ? val.join(', ') : String(val));
      const badgeClass = `tag-${stat}`;

      html += `
        <div class="field-item">
          <span class="field-key">${k}</span>
          <span class="field-val" title="${displayVal}">${displayVal}</span>
          <span class="${badgeClass}">${stat}</span>
        </div>
      `;
    }

    html += `
        </div>
      </div>

      <div class="dossier-card">
        <div class="kicker" style="margin-bottom: 8px;">SOFT ROMANTIC PREFERENCES</div>
        <div class="field-grid">
    `;

    for (const k of window.SimulationEngine.SOFT) {
      const val = member.fields[k];
      const stat = member.field_status[k];
      const displayVal = val === null ? '—' : String(val);
      const badgeClass = `tag-${stat}`;

      html += `
        <div class="field-item">
          <span class="field-key">${k}</span>
          <span class="field-val">${displayVal}</span>
          <span class="${badgeClass}">${stat}</span>
        </div>
      `;
    }

    html += `
        </div>
      </div>

      <div class="dossier-card">
        <div class="kicker" style="margin-bottom: 8px;">COMPATIBLE SUITORS (${partners.length})</div>
    `;

    if (partners.length === 0) {
      html += `<div style="font-family: var(--font-serif-body); font-size: 13px; font-style: italic; color: var(--text-muted); text-align: center; padding: 12px;">No feasible suitors in active registry.</div>`;
    } else {
      for (const p of partners.slice(0, 5)) {
        const o = p.other;
        const color = p.status === 'feasible' ? 'var(--accent-sage)' : 'var(--accent-amber)';
        html += `
          <div class="partner-card" onclick="window.simApp.selectMember(window.simApp.sim.members['${o.member_id}'])">
            <div>
              <div class="partner-name">${o.member_id} (${o.age}${o.gender[0].toUpperCase()}, ${o.zone})</div>
              <div class="partner-score">Score: ${(p.score * 100).toFixed(0)}% · <span style="color: ${color}">${p.status}</span></div>
            </div>
            <button class="btn btn-ink" style="font-size: 9.5px; padding: 4px 10px;" onclick="event.stopPropagation(); window.simApp.pairWith('${member.member_id}', '${o.member_id}')">
              Pair
            </button>
          </div>
        `;
      }
    }

    html += `</div>`;
    this.dom.inspectorContent.innerHTML = html;

    // Attach actions
    const btnAskBundle = document.getElementById('btnAskBundle');
    if (btnAskBundle) {
      btnAskBundle.addEventListener('click', () => {
        this.sim.resolveAsks([{ member_id: member.member_id, field: 'constraints' }]);
        this.updateVisualizer();
        this.updateUI();
      });
    }

    const btnAskGoal = document.getElementById('btnAskGoal');
    if (btnAskGoal) {
      btnAskGoal.addEventListener('click', () => {
        this.sim.resolveAsks([{ member_id: member.member_id, field: 'relationship_goal' }]);
        this.updateVisualizer();
        this.updateUI();
      });
    }
  }

  pairWith(idA, idB) {
    if (this.sim.day >= 60) {
      alert('Decision window has closed. Follow-up observation only.');
      return;
    }
    const pairs = this.sim.advance([[idA, idB]]);
    if (pairs.length > 0) {
      this.addEventLog('match', 'Manual Introduction', `Manually paired ${idA} and ${idB}`);
      this.updateVisualizer();
      this.updateUI();
    } else {
      alert('Could not pair: Candidates may be unavailable or hard constraints violated.');
    }
  }

  showTooltip(member, x, y) {
    if (!member) {
      this.dom.tooltip.style.display = 'none';
      return;
    }
    const m = this.sim.members[member.member_id];
    this.dom.tooltip.innerHTML = `
      <div style="font-family: var(--font-serif-hero); font-size: 14px; font-style: italic; color: var(--text-ink);">${m.member_id}</div>
      <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">
        ${m.age} yrs · ${m.gender} · ${m.zone.toUpperCase()}
      </div>
      <div style="font-size: 10px; font-weight: 600; color: ${m.available ? 'var(--accent-sage)' : 'var(--accent-amber)'}; margin-top: 3px;">
        ${m.available ? '● Available in Registry' : '○ Busy / Unavailable'}
      </div>
    `;
    this.dom.tooltip.style.display = 'block';
    this.dom.tooltip.style.left = `${x + 14}px`;
    this.dom.tooltip.style.top = `${y + 14}px`;
  }

  addEventLog(type, title, desc) {
    const card = document.createElement('div');
    card.className = `chronicle-card ${type}`;
    card.innerHTML = `
      <div class="chronicle-top">
        <span class="chronicle-title">${title}</span>
        <span class="chronicle-day">Day ${this.sim.day}</span>
      </div>
      <div class="chronicle-body">${desc}</div>
    `;
    this.dom.eventFeed.insertBefore(card, this.dom.eventFeed.firstChild);
    // Keep max 50 cards
    if (this.dom.eventFeed.children.length > 50) {
      this.dom.eventFeed.removeChild(this.dom.eventFeed.lastChild);
    }
  }
}

// Bootstrap once window loads
window.addEventListener('DOMContentLoaded', () => {
  window.simApp = new SimulationApp();
});
