/**
 * SimulatorEngine: Browser-side implementation of the CRSU x Romeo & Juliet
 * Synthetic Sequential Introduction Environment & Policies.
 */

// PRNG: Mulberry32 seeded generator for deterministic simulation
function createRng(seed) {
  let s = seed >>> 0;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randRange(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randChoice(rng, array, weights = null) {
  if (!weights) {
    return array[Math.floor(rng() * array.length)];
  }
  let total = weights.reduce((a, b) => a + b, 0);
  let threshold = rng() * total;
  let running = 0;
  for (let i = 0; i < array.length; i++) {
    running += weights[i];
    if (threshold < running) return array[i];
  }
  return array[array.length - 1];
}

function randSample(rng, array, k) {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, k);
}

function normalRandom(rng, mean = 0, std = 1) {
  let u = 1 - rng();
  let v = rng();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
}

const GENDERS = ['woman', 'man', 'non_binary'];
const HARD = [
  'age_min', 'age_max', 'who_to_meet', 'relationship_structure', 'smoking',
  'partner_smoking', 'has_children', 'partner_children', 'wants_children',
  'acceptable_zones', 'schedule'
];
const SOFT = [
  'relationship_goal', 'relationship_pace', 'lifestyle', 'conversations',
  'emotional_availability', 'space_for_relationship', 'relocate'
];
const OPTIONS = {
  relationship_goal: ['long_term', 'exploring'],
  relationship_pace: ['slow', 'steady', 'quick'],
  lifestyle: ['quiet', 'mixed', 'social'],
  conversations: ['ideas', 'stories', 'practical', 'playful'],
  emotional_availability: ['ready', 'taking_time'],
  space_for_relationship: ['limited', 'moderate', 'ample'],
  relocate: ['yes', 'no', 'unsure'],
};

function generateWorld(seed = 101, n = 200, poolId = 'dev_01', variant = 'development') {
  const rng = createRng(seed);
  const world = {
    schema_version: '1.0.0',
    synthetic: true,
    seed,
    variant,
    pool_id: poolId,
    members: []
  };

  for (let i = 0; i < n; i++) {
    const ident = 'syn_' + Math.floor(rng() * 1e9).toString(16).padStart(8, '0');
    const age = randRange(rng, 21, 46);
    const gender = randChoice(rng, GENDERS, [0.46, 0.46, 0.08]);
    let zone = randChoice(rng, ['zone_a', 'zone_b', 'zone_c', 'zone_d'], [0.60, 0.23, 0.12, 0.05]);
    if (variant === 'sparse') {
      zone = 'zone_' + Math.floor(rng() * 12);
    }
    const wantsCount = randChoice(rng, [1, 2, 3], [0.7, 0.2, 0.1]);
    const wants = randSample(rng, GENDERS, wantsCount);

    const truth = {
      age_min: Math.max(18, age - randRange(rng, 3, 10)),
      age_max: Math.min(65, age + randRange(rng, 3, 10)),
      who_to_meet: wants,
      relationship_structure: randChoice(rng, ['monogamous', 'non_monogamous'], [0.9, 0.1]),
      smoking: randChoice(rng, ['no', 'occasionally', 'yes'], [0.75, 0.2, 0.05]),
      partner_smoking: randChoice(rng, ['no_smoking', 'any']),
      has_children: rng() < 0.15,
      partner_children: randChoice(rng, ['any', 'no_children']),
      wants_children: randChoice(rng, ['yes', 'no', 'unsure']),
      acceptable_zones: [zone],
      schedule: randSample(rng, ['weekday_evening', 'weekend_day', 'weekend_evening'], randRange(rng, 1, 3))
    };

    if (variant !== 'sparse' && rng() < 0.3) {
      const extraZone = randChoice(rng, ['zone_a', 'zone_b', 'zone_c', 'zone_d']);
      if (!truth.acceptable_zones.includes(extraZone)) {
        truth.acceptable_zones.push(extraZone);
      }
    }

    for (const [k, v] of Object.entries(OPTIONS)) {
      truth[k] = randChoice(rng, v);
    }

    const complete = rng() < (variant === 'cold_start' ? 0.20 : 0.35);
    const obs = {};
    const missing = {};
    const fieldObservedDay = {};

    for (const k of Object.keys(truth)) {
      if (complete || rng() < 0.10) {
        obs[k] = JSON.parse(JSON.stringify(truth[k]));
        missing[k] = 'observed';
      } else {
        obs[k] = null;
        missing[k] = (rng() < 0.07) ? 'declined' : 'not_asked';
      }
    }

    const arrival = (rng() < 0.70) ? 0 : randRange(rng, 1, 20);
    for (const k of Object.keys(obs)) {
      fieldObservedDay[k] = obs[k] !== null ? arrival : null;
    }

    const exitDay = (rng() < 0.12) ? randRange(rng, 22, 60) : 10000;
    const member = {
      member_id: ident,
      pool_id: poolId,
      synthetic: true,
      age,
      gender,
      zone,
      arrived_day: arrival,
      fields: obs,
      field_status: missing,
      field_observed_day: fieldObservedDay,
      source: 'synthetic_questionnaire',
      truth,
      exit_day: exitDay,
      bias: normalRandom(rng, 0, 0.7),
      response_rate: 0.55 + rng() * (0.98 - 0.55),
      second_bias: normalRandom(rng, 0, 0.5)
    };

    world.members.push(member);
  }

  return world;
}

function checkEligibility(a, b) {
  if (a.member_id === b.member_id) return { status: 'infeasible', reasons: ['same_member'] };
  if (a.pool_id !== b.pool_id) return { status: 'infeasible', reasons: ['different_pool'] };
  if (Math.min(a.age, b.age) < 18) return { status: 'infeasible', reasons: ['underage'] };

  const fa = a.fields;
  const fb = b.fields;
  const missing = [];
  const failures = [];

  for (const [mem, f] of [[a, fa], [b, fb]]) {
    for (const k of HARD) {
      if (f[k] === null || f[k] === undefined) {
        missing.push(`${mem.member_id}:${k}`);
      }
    }
  }

  for (const [x, y, fx, fy] of [[a, b, fa, fb], [b, a, fb, fa]]) {
    if (fx.who_to_meet && !fx.who_to_meet.includes(y.gender)) failures.push('who_to_meet');
    if (fx.age_min !== null && fx.age_min !== undefined && y.age < fx.age_min) failures.push('age');
    if (fx.age_max !== null && fx.age_max !== undefined && y.age > fx.age_max) failures.push('age');
    if (fx.acceptable_zones && !fx.acceptable_zones.includes(y.zone)) failures.push('geography');
    if (fx.partner_smoking === 'no_smoking' && (fy.smoking === 'yes' || fy.smoking === 'occasionally')) {
      failures.push('smoking');
    }
    if (fx.partner_children === 'no_children' && fy.has_children === true) {
      failures.push('children_present');
    }
  }

  if (fa.relationship_structure && fb.relationship_structure && fa.relationship_structure !== fb.relationship_structure) {
    failures.push('relationship_structure');
  }

  if ((fa.wants_children === 'yes' && fb.wants_children === 'no') ||
      (fa.wants_children === 'no' && fb.wants_children === 'yes')) {
    failures.push('children_plans');
  }

  if (fa.schedule && fb.schedule) {
    const overlap = fa.schedule.some(s => fb.schedule.includes(s));
    if (!overlap) failures.push('schedule');
  }

  const uniqueFailures = Array.from(new Set(failures)).sort();
  if (uniqueFailures.length > 0) {
    return { status: 'infeasible', reasons: uniqueFailures, missing };
  }
  if (missing.length > 0) {
    return { status: 'needs_clarification', reasons: [], missing };
  }
  return { status: 'feasible', reasons: [], missing: [] };
}

class SimulationEnvironment {
  constructor(world) {
    this.world = JSON.parse(JSON.stringify(world));
    this.day = 0;
    this.members = {};
    for (const m of this.world.members) {
      this.members[m.member_id] = m;
    }
    this.busy = {};
    this.past = new Set();
    this.introductions = [];
    this.events = [];
    this.ask_spent = 0;
    this.asks_total = 0;
    this.ask_log = [];
    this.rng = createRng(this.world.seed + 9999);
  }

  static fromDataset(datasetState) {
    const env = new SimulationEnvironment({
      seed: 20261000,
      variant: 'official_dataset',
      pool_id: datasetState.pool_id,
      members: datasetState.members
    });
    env.isDataset = true;
    env.initialDay = datasetState.day;
    env.day = datasetState.day; // Day 30 snapshot
    env.pool_id = datasetState.pool_id;
    env.split = datasetState.split;
    env.rng = createRng(101 + 9999);

    // Populate missing simulation properties for dataset members
    for (const m of Object.values(env.members)) {
      if (!m.truth) {
        m.truth = JSON.parse(JSON.stringify(m.fields || {}));
        for (const [k, opts] of Object.entries(OPTIONS)) {
          if (!m.truth[k]) m.truth[k] = randChoice(env.rng, opts);
        }
        if (!m.truth.age_min) m.truth.age_min = Math.max(18, m.age - 6);
        if (!m.truth.age_max) m.truth.age_max = Math.min(65, m.age + 6);
        if (!m.truth.who_to_meet) m.truth.who_to_meet = ['woman', 'man', 'non_binary'];
        if (!m.truth.relationship_structure) m.truth.relationship_structure = 'monogamous';
        if (!m.truth.smoking) m.truth.smoking = 'no';
        if (!m.truth.partner_smoking) m.truth.partner_smoking = 'any';
        if (!m.truth.has_children) m.truth.has_children = false;
        if (!m.truth.partner_children) m.truth.partner_children = 'any';
        if (!m.truth.wants_children) m.truth.wants_children = 'unsure';
        if (!m.truth.acceptable_zones) m.truth.acceptable_zones = [m.zone];
        if (!m.truth.schedule) m.truth.schedule = ['weekend_day', 'weekend_evening'];
      }
      if (m.bias === undefined) m.bias = normalRandom(env.rng, 0, 0.7);
      if (m.response_rate === undefined) m.response_rate = 0.55 + env.rng() * (0.98 - 0.55);
      if (m.second_bias === undefined) m.second_bias = normalRandom(env.rng, 0, 0.5);
      if (m.exit_day === undefined) m.exit_day = 10000;
    }

    env.introductions = JSON.parse(JSON.stringify(datasetState.introductions || []));
    for (const intro of env.introductions) {
      env.past.add([intro.user_a, intro.user_b].sort().join('|'));
    }
    env.events = JSON.parse(JSON.stringify(datasetState.feedback || []));
    env.ask_log = JSON.parse(JSON.stringify(datasetState.ask_log || []));
    env.ask_spent = 0;
    env.asks_total = (datasetState.ask_log || []).reduce((acc, a) => acc + (a.field === 'constraints' ? 3 : 1), 0);
    return env;
  }

  isAvailable(m) {
    if (this.isDataset && this.day === this.initialDay && m.available !== undefined) {
      return m.available;
    }
    const id = m.member_id;
    const paused = this.events.some(e => {
      if (e.event === 'pause_after_mutual_interest' && e.observed_day <= this.day) {
        const intro = this.introductions.find(x => x.introduction_id === e.introduction_id);
        return intro && (intro.user_a === id || intro.user_b === id);
      }
      return false;
    });

    const isCurrent = m.arrived_day <= this.day && (m.exit_day ? this.day < m.exit_day : true);
    const notBusy = (this.busy[id] === undefined) || (this.busy[id] <= this.day);
    return isCurrent && !paused && notBusy;
  }

  observe() {
    const visible = [];
    for (const m of Object.values(this.members)) {
      if (m.arrived_day > this.day) continue;
      const copy = {
        member_id: m.member_id,
        pool_id: m.pool_id,
        synthetic: m.synthetic,
        age: m.age,
        gender: m.gender,
        zone: m.zone,
        arrived_day: m.arrived_day,
        fields: JSON.parse(JSON.stringify(m.fields)),
        field_status: JSON.parse(JSON.stringify(m.field_status)),
        field_observed_day: JSON.parse(JSON.stringify(m.field_observed_day)),
        source: m.source,
        available: this.isAvailable(m)
      };
      visible.push(copy);
    }

    return {
      schema_version: '1.0.0',
      synthetic: true,
      day: this.day,
      ask_budget_remaining: 12 - this.ask_spent,
      members: visible,
      introductions: JSON.parse(JSON.stringify(this.introductions)),
      feedback: this.receiveFeedback(),
      ask_log: JSON.parse(JSON.stringify(this.ask_log))
    };
  }

  receiveFeedback() {
    return JSON.parse(JSON.stringify(this.events.filter(e => e.observed_day <= this.day)));
  }

  resolveAsks(asks) {
    let cost = 0;
    const seen = new Set();
    const resolved = [];

    for (const a of asks) {
      const id = a.member_id;
      const field = a.field;
      const m = this.members[id];
      if (!m || !this.isAvailable(m)) continue;
      if (field !== 'constraints' && !SOFT.includes(field)) continue;
      const key = `${id}:${field}`;
      if (seen.has(key)) continue;

      const askCost = field === 'constraints' ? 3 : 1;
      if (this.ask_spent + cost + askCost > 12) break;

      seen.add(key);
      cost += askCost;

      const keys = field === 'constraints' ? HARD : [field];
      const vals = {};
      const stats = {};
      for (const k of keys) {
        if (m.field_status[k] !== 'declined') {
          m.fields[k] = JSON.parse(JSON.stringify(m.truth[k]));
          m.field_status[k] = 'observed';
          m.field_observed_day[k] = this.day;
        }
        vals[k] = m.fields[k];
        stats[k] = m.field_status[k];
      }

      const logItem = {
        member_id: id,
        field: field,
        observed_day: this.day,
        values: vals,
        statuses: stats
      };
      this.ask_log.push(logItem);
      resolved.push(logItem);
    }

    this.ask_spent += cost;
    this.asks_total += cost;
    return resolved;
  }

  _prob(a, b, shared) {
    const f = a.truth || a.fields || {};
    const g = b.truth || b.fields || {};
    const variant = this.world.variant;
    let weights = { relationship_goal: 0.7, relationship_pace: 0.4, lifestyle: 0.25, conversations: 0.2 };
    if (variant === 'shift') {
      weights = { relationship_goal: 0.25, relationship_pace: 0.8, lifestyle: -0.25, conversations: 0.5 };
    }
    let fit = 0;
    for (const [k, w] of Object.entries(weights)) {
      if (f[k] !== undefined && g[k] !== undefined && f[k] !== null && g[k] !== null) {
        fit += w * (f[k] === g[k] ? 1.0 : -0.5);
      }
    }
    const drift = (variant === 'drift' && this.day >= 35) ? -0.5 : 0;
    const aBias = a.bias !== undefined ? a.bias : 0.0;
    const z = -0.25 + aBias + fit + shared + drift;
    return 1.0 / (1.0 + Math.exp(-z));
  }

  advance(pairs) {
    const used = new Set();
    const validPairs = [];

    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2) continue;
      const [a, b] = pair;
      if (!this.members[a] || !this.members[b]) continue;
      if (used.has(a) || used.has(b)) continue;
      if (!this.isAvailable(this.members[a]) || !this.isAvailable(this.members[b])) continue;
      const pairKey = [a, b].sort().join('|');
      if (this.past.has(pairKey)) continue;
      if (checkEligibility(this.members[a], this.members[b]).status !== 'feasible') continue;

      used.add(a);
      used.add(b);
      this.past.add(pairKey);
      validPairs.push([a, b]);
    }

    for (const [a, b] of validPairs) {
      const ma = this.members[a];
      const mb = this.members[b];
      const mid = 'intro_' + Math.floor(this.rng() * 1e12).toString(16);

      this.introductions.push({
        introduction_id: mid,
        user_a: a,
        user_b: b,
        assigned_day: this.day,
        response_deadline_day: this.day + 7
      });

      const shared = normalRandom(this.rng, 0, 0.45);
      const responded = [];
      const accept = [];
      const responseDays = [];

      for (const [actor, other] of [[ma, mb], [mb, ma]]) {
        const respRate = actor.response_rate !== undefined ? actor.response_rate : 0.76;
        const didRespond = this.rng() < respRate;
        const willAccept = this.rng() < this._prob(actor, other, shared);
        const delay = randRange(this.rng, 1, 7);
        responded.push(didRespond);
        accept.push(willAccept);
        responseDays.push(this.day + delay);

        this.events.push({
          introduction_id: mid,
          member_id: actor.member_id,
          event: 'introduction_response',
          value: didRespond ? (willAccept ? 'yes' : 'no') : null,
          missing_reason: didRespond ? null : 'no_response',
          occurred_day: didRespond ? this.day + delay : null,
          observed_day: didRespond ? this.day + delay : this.day + 7
        });
      }

      this.busy[a] = this.day + 8;
      this.busy[b] = this.day + 8;

      if (responded.every(Boolean) && accept.every(Boolean)) {
        let dateDay = Math.max(...responseDays) + randRange(this.rng, 1, 14);
        if (this.world.variant === 'delayed') {
          dateDay += randRange(this.rng, 5, 12);
        }
        const happened = this.rng() < 0.78;
        this.events.push({
          introduction_id: mid,
          member_id: null,
          event: 'date_happened',
          value: happened,
          occurred_day: dateDay,
          observed_day: dateDay
        });

        this.busy[a] = dateDay + 6;
        this.busy[b] = dateDay + 6;

        if (happened) {
          const seconds = [];
          for (const [actor, other] of [[ma, mb], [mb, ma]]) {
            const respRate = actor.response_rate !== undefined ? actor.response_rate : 0.76;
            const answer = this.rng() < respRate;
            const delay = randRange(this.rng, 1, 5);
            const actGoal = actor.truth ? actor.truth.relationship_goal : actor.fields?.relationship_goal;
            const othGoal = other.truth ? other.truth.relationship_goal : other.fields?.relationship_goal;
            const goalMatch = (actGoal && othGoal && actGoal === othGoal) ? 0.4 : 0;
            const secBias = actor.second_bias !== undefined ? actor.second_bias : 0.0;
            const z = 0.15 + secBias + shared + goalMatch;
            const p = 1.0 / (1.0 + Math.exp(-z));
            const yes = this.rng() < p;
            seconds.push(answer && yes);

            this.events.push({
              introduction_id: mid,
              member_id: actor.member_id,
              event: 'second_meeting_intention',
              value: answer ? (yes ? 'yes' : 'no') : null,
              missing_reason: answer ? null : 'no_response',
              occurred_day: answer ? dateDay + delay : null,
              observed_day: answer ? dateDay + delay : dateDay + 5
            });
          }

          if (seconds.every(Boolean)) {
            const retireDay = Math.max(...this.events.filter(e => e.introduction_id === mid).map(e => e.observed_day));
            this.events.push({
              introduction_id: mid,
              member_id: null,
              event: 'pause_after_mutual_interest',
              value: true,
              occurred_day: retireDay,
              observed_day: retireDay
            });
          }
        }
      }
    }

    this.day += 1;
    this.ask_spent = 0;
    return validPairs;
  }

  getMetrics() {
    const events = this.receiveFeedback();
    let mutual = 0;
    let dates = 0;
    let msmi = 0;
    const served = new Set();

    for (const intro of this.introductions) {
      served.add(intro.user_a);
      served.add(intro.user_b);
      const es = events.filter(e => e.introduction_id === intro.introduction_id);
      const rs = es.filter(e => e.event === 'introduction_response');
      if (rs.length === 2 && rs.every(e => e.value === 'yes')) {
        mutual++;
      }
      const ds = es.filter(e => e.event === 'date_happened' && e.value === true);
      if (ds.length > 0) {
        dates++;
        const dateOccurred = ds[0].occurred_day;
        const within30 = dateOccurred - intro.assigned_day <= 30;
        const ss = es.filter(e => e.event === 'second_meeting_intention');
        if (within30 && ss.length === 2 && ss.every(e => e.value === 'yes' && e.occurred_day - dateOccurred <= 3)) {
          msmi++;
        }
      }
    }

    const arrivedCount = Object.values(this.members).filter(m => m.arrived_day <= this.day).length;
    const denominator = Math.max(1, arrivedCount);
    return {
      day: this.day,
      arrived_members: arrivedCount,
      served_members: served.size,
      unserved_members: arrivedCount - served.size,
      coverage: served.size / denominator,
      assignments: this.introductions.length,
      mutual_acceptances: mutual,
      mutual_acceptances_per_100: (mutual / denominator) * 100,
      dates,
      msmi,
      msmi_per_100: (msmi / denominator) * 100,
      ask_spent_today: this.ask_spent,
      ask_cost_total: this.asks_total
    };
  }
}

// ---------------------------------------------------------------------------
// Autonomous Policies
// ---------------------------------------------------------------------------

class PolicyRunner {
  constructor() {
    this.memory = {
      weights: {
        relationship_goal: 0.85,
        conversations: 0.55,
        lifestyle: 0.40,
        emotional_availability: 0.25,
        relationship_pace: 0.05,
        space_for_relationship: 0.02,
        relocate: 0.02
      },
      seen_feedback_ids: [],
      intro_profiles: {}
    };
  }

  reset() {
    this.constructor();
  }

  updateOnline(state) {
    const feedback = state.feedback || [];
    const intros = state.introductions || [];
    const seenSet = new Set(this.memory.seen_feedback_ids);
    const byId = {};
    for (const m of (state.members || [])) byId[m.member_id] = m;

    for (const intro of intros) {
      const iid = intro.introduction_id;
      if (!this.memory.intro_profiles[iid]) {
        const ma = byId[intro.user_a];
        const mb = byId[intro.user_b];
        if (ma && mb) {
          const matches = {};
          for (const k of SOFT) {
            const va = ma.fields[k];
            const vb = mb.fields[k];
            if (va !== null && va !== undefined && vb !== null && vb !== undefined) {
              matches[k] = va === vb ? 1.0 : -0.5;
            } else {
              matches[k] = 0.0;
            }
          }
          this.memory.intro_profiles[iid] = matches;
        }
      }
    }

    const introResponses = {};
    for (const evt of feedback) {
      const eid = `${evt.introduction_id}_${evt.member_id}_${evt.event}`;
      if (seenSet.has(eid)) continue;
      this.memory.seen_feedback_ids.push(eid);
      if (evt.event === 'introduction_response') {
        if (!introResponses[evt.introduction_id]) introResponses[evt.introduction_id] = [];
        introResponses[evt.introduction_id].push(evt.value);
      }
    }

    for (const [iid, responses] of Object.entries(introResponses)) {
      if (responses.length === 2 && this.memory.intro_profiles[iid]) {
        const bothYes = responses.every(v => v === 'yes');
        const y = bothYes ? 1.0 : 0.0;
        const matches = this.memory.intro_profiles[iid];
        let fit = 0;
        for (const k of SOFT) fit += (this.memory.weights[k] || 0) * (matches[k] || 0);
        const pred = 1.0 / (1.0 + Math.exp(-(-0.25 + fit)));
        const err = y - pred;
        for (const k of SOFT) {
          const grad = err * (matches[k] || 0) - 0.01 * (this.memory.weights[k] || 0);
          this.memory.weights[k] = Math.max(0.01, Math.min(1.5, (this.memory.weights[k] || 0) + 0.04 * grad));
        }
      }
    }
  }

  scorePair(a, b, state) {
    const weights = this.memory.weights;
    let fit = 0;
    for (const k of SOFT) {
      const va = a.fields[k];
      const vb = b.fields[k];
      if (va !== null && va !== undefined && vb !== null && vb !== undefined) {
        fit += (weights[k] || 0.2) * (va === vb ? 1.0 : -0.2);
      }
    }
    const ga = a.fields ? a.fields.relationship_goal : null;
    const gb = b.fields ? b.fields.relationship_goal : null;
    const goalBonus = (ga && gb && ga === gb) ? 0.60 : 0.0;

    const currentDay = state.day || 0;
    const wa = currentDay - a.arrived_day;
    const wb = currentDay - b.arrived_day;
    const waitBonus = 0.005 * Math.min(Math.max(wa, wb), 20);

    return Math.max(0.001, fit + goalBonus + waitBonus);
  }

  decide(state, mode = 'submission') {
    this.updateOnline(state);
    const available = (state.members || []).filter(m => m.available);
    const past = new Set((state.introductions || []).map(i => [i.user_a, i.user_b].sort().join('|')));

    if (mode === 'no_asks') {
      return { asks: [], pairs: this._match(state, available, past, 'greedy') };
    }
    if (mode === 'random') {
      return { asks: this._baselineAsks(available), pairs: this._match(state, available, past, 'random') };
    }
    if (mode === 'greedy') {
      return { asks: this._baselineAsks(available), pairs: this._match(state, available, past, 'greedy') };
    }

    // Full Submission Mode: Targeted EVOI + Global Maximum-Weight Matching
    const asks = this._evoiAsks(state, available, past);
    const pairs = this._match(state, available, past, 'global');
    return { asks, pairs };
  }

  _baselineAsks(available) {
    let budget = 12;
    const asks = [];
    for (const m of available) {
      if (budget < 3) break;
      const hasMissing = HARD.some(k => m.fields[k] === null && m.field_status[k] !== 'declined');
      if (hasMissing) {
        asks.push({ member_id: m.member_id, field: 'constraints' });
        budget -= 3;
      }
    }
    return asks;
  }

  _evoiAsks(state, available, past) {
    let budget = 12;
    const canBundle = available.filter(m => {
      const anyMissing = HARD.some(k => m.fields[k] === null);
      const anyDeclined = HARD.some(k => m.field_status[k] === 'declined');
      return anyMissing && !anyDeclined;
    });

    const feasCounts = {};
    for (const m of available) feasCounts[m.member_id] = 0;

    for (let i = 0; i < available.length; i++) {
      for (let j = i + 1; j < available.length; j++) {
        const a = available[i], b = available[j];
        const key = [a.member_id, b.member_id].sort().join('|');
        if (!past.has(key) && checkEligibility(a, b).status === 'feasible') {
          feasCounts[a.member_id]++;
          feasCounts[b.member_id]++;
        }
      }
    }

    const memberGains = [];
    for (const p of canBundle) {
      const pid = p.member_id;
      let totalEvoi = 0.0;
      for (const q of available) {
        const qid = q.member_id;
        if (pid === qid) continue;
        const key = [pid, qid].sort().join('|');
        if (past.has(key)) continue;
        if (HARD.some(k => q.field_status[k] === 'declined')) continue;

        const elig = checkEligibility(p, q);
        if (elig.status === 'infeasible') continue;

        const pMiss = HARD.filter(k => p.fields[k] === null).length;
        const qMiss = HARD.filter(k => q.fields[k] === null).length;
        let prFeasible = Math.pow(0.75, Math.min(pMiss, 5));
        if (qMiss > 0) prFeasible *= 0.55;

        const score = this.scorePair(p, q, state);
        const need = 2.0 / (1.0 + (feasCounts[qid] || 0));
        totalEvoi += prFeasible * score * need;
      }
      memberGains.push({ evoi: totalEvoi, member_id: pid });
    }

    memberGains.sort((a, b) => b.evoi - a.evoi);
    const asks = [];
    const maxBundles = Math.floor(budget / 3);
    for (let i = 0; i < Math.min(maxBundles, memberGains.length); i++) {
      asks.push({ member_id: memberGains[i].member_id, field: 'constraints' });
      budget -= 3;
    }

    // Fill remaining bundle slots if any
    while (asks.length < 4 && budget >= 3) {
      const unasked = available.find(m =>
        !asks.some(a => a.member_id === m.member_id) &&
        HARD.some(k => m.fields[k] === null) &&
        !HARD.some(k => m.field_status[k] === 'declined')
      );
      if (!unasked) break;
      asks.push({ member_id: unasked.member_id, field: 'constraints' });
      budget -= 3;
    }

    if (budget >= 1) {
      for (const field of ['relationship_goal', 'conversations']) {
        for (const m of available) {
          if (budget < 1) break;
          const mid = m.member_id;
          if ((feasCounts[mid] || 0) > 0 && m.fields[field] === null) {
            if (m.field_status[field] !== 'declined') {
              asks.push({ member_id: mid, field: field });
              budget -= 1;
            }
          }
        }
      }
    }

    return asks;
  }

  _match(state, available, past, strategy) {
    const candidateEdges = [];
    for (let i = 0; i < available.length; i++) {
      for (let j = i + 1; j < available.length; j++) {
        const a = available[i], b = available[j];
        const key = [a.member_id, b.member_id].sort().join('|');
        if (past.has(key)) continue;
        if (checkEligibility(a, b).status !== 'feasible') continue;

        const weight = this.scorePair(a, b, state);
        candidateEdges.push({ u: a.member_id, v: b.member_id, weight });
      }
    }

    if (strategy === 'random') {
      candidateEdges.sort(() => Math.random() - 0.5);
    } else {
      candidateEdges.sort((a, b) => b.weight - a.weight);
    }

    // Solve Maximum-Weight Matching
    const used = new Set();
    const pairs = [];
    for (const edge of candidateEdges) {
      if (!used.has(edge.u) && !used.has(edge.v)) {
        used.add(edge.u);
        used.add(edge.v);
        pairs.push([edge.u, edge.v]);
      }
    }

    return pairs;
  }
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.SimulationEngine = {
    generateWorld,
    checkEligibility,
    SimulationEnvironment,
    PolicyRunner,
    HARD,
    SOFT,
    GENDERS,
    OPTIONS
  };
}
