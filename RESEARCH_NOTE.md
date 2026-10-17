# Approach Note: Global Reciprocal Matching with Value-of-Information Clarification

**Challenge**: CRSU x Romeo & Juliet Hackathon · Vouchsafe Track  
**Document**: Round 1 Research Submission Note (Specification 1.0.0)  
**Date**: October 2026  
**Primary Metric**: Mutual Second-Meeting Intention (MSMI) per 100 Arrived Members  

---

## 1. Problem Interpretation & Operational Formulation

In the **One Introduction Problem**, an autonomous policy orchestrates sequential introductions across an evolving pool of synthetic candidates over a 60-day decision horizon, followed by a 40-day observation window. At each discrete day *t* ∈ [0, 59], the policy interacts with the environment through a two-phase protocol:
1. **Ask Phase**: Allocate a daily budget *B* = 12 units to clarify unknown attributes. Bundled hard constraints cost 3 units; individual soft fields cost 1 unit.
2. **Match Phase**: Propose a set of disjoint, feasible reciprocal introductions *M_t* = {(u₁, v₁), (u₂, v₂), …} among currently available members.

### Core Challenges
* **Strict Non-Overlapping Reciprocity**: An introduction requires concurrent, reciprocal participation. Each member can participate in at most one active introduction at any given time and remains occupied through response and date windows (up to 20+ days).
* **Information Incompleteness & Privacy**: Questionnaire fields are substantially incomplete. In the public training pools, **31.3% of hard-constraint fields are unobserved**, and **4.3% are explicitly declined**. A single unverified hard constraint renders a pair non-matchable (`needs_clarification`), while declined fields can never be bypassed or inferred.
* **Delayed & Censored Feedback**: The primary target—**Mutual Second-Meeting Intention (MSMI)**—unfolds along a fragile sequential funnel:
  $$\text{Introduction} \xrightarrow{\le 7\text{d}} \text{Mutual Acceptance} \xrightarrow{\le 14\text{d}} \text{Date Event} \xrightarrow{\le 3\text{d}} \text{Mutual Second Yes}$$
  Outcomes mature with substantial delays. Premature evaluation introduces heavy right-censoring bias.
* **Systemic Negative Externalities**: Introducing candidate *u* to *v* today removes both from the candidate pool for weeks, potentially depriving higher-compatibility future arrivals of their optimal partners.

---

## 2. Hypothesis

> **Primary Hypothesis**:  
> *"Global max-weight matching over a feasibility graph + clarifying only when it unlocks a high-value pair beats greedy pair ranking."*

### Theoretical Foundations
1. **Suboptimality of Greedy Pair Allocation**:  
   Independent greedy ranking selects pairs sequentially in descending order of individual score. As demonstrated in Section 2 of the specification, greedy allocation creates severe negative externalities. In a four-person subpool where pair (A, B) scores 0.90, (C, D) scores 0.05, and both (A, D) and (B, C) score 0.65, greedy selection takes (A, B) and (C, D) for a total value of 0.95. Global maximum-weight matching selects (A, D) and (B, C), achieving an aggregate value of 1.30 (+36.8%).
2. **Targeted Value-of-Information (VOI) vs. Blind Clarification**:  
   The reference greedy baseline exhausts the daily budget by querying constraint bundles on the first arbitrary unclarified members in queue order (costing ~205 units per episode). This wastes budget clarifying isolated individuals who have no feasible, high-potential matches in the pool. By contrast, clarifying *only* when resolving uncertainty unlocks an edge in the top quantile of the predicted reciprocal affinity distribution concentrates the 12-unit daily budget strictly where it produces actionable introductions.

---

## 3. Reciprocal Feasibility & Eligibility Modeling

A pair (u, v) is valid if and only if `eligibility(u, v)['status'] == 'feasible'`. Feasibility requires symmetric satisfaction across all 11 hard constraints:

$$\text{Feasible}(u, v) \iff \bigwedge_{k \in \text{HARD}} \text{Check}_k(u, v) \wedge \text{Check}_k(v, u)$$

### Hard Constraint Ontology
| Field | Symmetrical Rule & Logic | Failure Reason |
|---|---|---|
| `age_min`, `age_max` | v.age ∈ [u.age_min, u.age_max] ∧ u.age ∈ [v.age_min, v.age_max] | `age` |
| `who_to_meet` | v.gender ∈ u.who_to_meet ∧ u.gender ∈ v.who_to_meet | `who_to_meet` |
| `acceptable_zones` | v.zone ∈ u.acceptable_zones ∧ u.zone ∈ v.acceptable_zones | `geography` |
| `relationship_structure` | u.relationship_structure == v.relationship_structure (`monogamous` vs `non_monogamous`) | `relationship_structure` |
| `smoking` / `partner_smoking` | u.partner_smoking == 'no_smoking' ⇒ v.smoking == 'no' (and reciprocally) | `smoking` |
| `has_children` / `partner_children` | u.partner_children == 'no_children' ⇒ v.has_children == False (and reciprocally) | `children_present` |
| `wants_children` | Conflict if {u.wants_children, v.wants_children} == {'yes', 'no'} (`unsure` permitted) | `children_plans` |
| `schedule` | u.schedule ∩ v.schedule ≠ ∅ (at least 1 overlapping slot) | `schedule` |

### Priority & Incompleteness Semantics
* **Strict Priority**: Any known violation immediately assigns status `infeasible`. No soft affinity score or missing attribute can override a hard violation.
* **Pending Clarification**: If no hard failure exists but ≥ 1 hard field is unobserved, status is `needs_clarification`.
* **Declined Immutability**: If a candidate refused a required hard field (`declined`), the constraint remains permanently unverified. The pair is irrecoverably non-matchable.

---

## 4. Allocation Method: Global Maximum-Weight Matching

Rather than committing pairs greedily, we construct a global compatibility graph *G_t = (V_t, E_t)* at each day *t*:
* **Vertices *V_t***: Available, arrived candidates (*v*.available == True).
* **Edges *E_t***: Mutually feasible, previously unintroduced pairs:
  $$E_t = \{(u, v) \in V_t \times V_t : u < v, \text{eligibility}(u, v) = \text{'feasible'}, (u, v) \notin \text{PastIntroductions}\}$$

### Edge Weight Formulation
Each feasible edge (u, v) ∈ *E_t* is weighted by composite utility *W(u, v)*:

$$W(u, v) = \hat{P}_{\text{MSMI}}(u, v) + \lambda_{\text{soft}} \cdot S_{\text{soft}}(u, v) + \lambda_{\text{wait}} \cdot \max(w_u, w_v) - \lambda_{\text{slack}} \cdot |w_u - w_v|$$

Where:
1. **Predicted Outcome Affinity $\hat{P}_{\text{MSMI}}(u, v)$**: Estimated probability of mutual date and second meeting given observed soft attributes.
2. **Soft Feature Overlap $S_{\text{soft}}(u, v)$**: Normalized agreement across soft attributes:
   $$S_{\text{soft}}(u, v) = \frac{1}{|\text{SOFT}|} \sum_{k \in \text{SOFT}} \mathbb{I}[u.\text{fields}[k] == v.\text{fields}[k] \wedge u.\text{fields}[k] \neq \text{None}]$$
3. **Starvation & Waiting Pressure $w_u = t - u.\text{arrived\_day}$**: Linearly escalates matching priority for long-waiting candidates to safeguard pool coverage and prevent starvation.
4. **Waiting Balance Penalty**: Encourages pairings between members with comparable tenure in the pool.

### Optimization Formulation
We solve the classical Maximum Weight General Matching problem (Edmonds' Blossom Algorithm):

$$\max_{M \subseteq E_t} \sum_{(u, v) \in M} W(u, v) \quad \text{subject to} \quad \sum_{e \in M : v \in e} 1 \le 1 \quad \forall v \in V_t$$

### Thresholded Patient Matching
To avoid forcing low-affinity introductions among newly arrived members who would benefit from waiting for compatible arrivals, an edge (u, v) is included only if:
$$W(u, v) \ge \theta_{\text{patience}}(w_u, w_v)$$
Where $\theta_{\text{patience}}$ decays monotonically with waiting time: newly arrived candidates face a high compatibility threshold, whereas candidates approaching pool exit face a relaxed threshold.

---

## 5. Clarification Strategy: Targeted Value-of-Information (EVOI)

The reference implementation naively queries `constraints` bundles for arbitrary unclarified members. In contrast, our strategy deploys a **Targeted Expected Value of Information (EVOI)** policy.

```
       Candidate Graph Analysis
                 │
  ┌──────────────┴──────────────┐
  ▼                             ▼
Confirmed Feasible         Uncertain Pair (u, v)
  E_feas                    needs_clarification
  (Direct Matching)             │
                         Are soft priors & potential
                         edge weight W(u, v) >= tau?
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
                   YES                      NO
            Calculate EVOI:          Skip (Preserve
         Delta Matching Score          Ask Budget)
                    │
         Rank asks by EVOI / Cost
         Execute top asks in budget
```

### Clarification Algorithm
1. **Identify Unlocking Opportunities**:  
   Examine candidate pairs (u, v) currently in `needs_clarification` status that have zero known hard failures.
2. **Estimate Latent Weight $\tilde{W}(u, v)$**:  
   Compute expected compatibility using observed soft features and empirical base rates of hard constraint concordance.
3. **Marginal Graph Contribution**:  
   Calculate the expected increase in the global matching weight if (u, v) becomes feasible:
   $$\Delta \text{Matching}(u, v) = \mathbb{E}\big[\text{Weight}(M(G \cup \{(u, v)\})) - \text{Weight}(M(G))\big]$$
4. **Cost-Normalized Priority**:  
   * If both *u* and *v* have missing hard fields, unlocking requires 6 units (two bundles).
   * If only one party has missing fields, unlocking requires 3 units (one bundle).
   * Sort candidate queries by $\frac{\Delta \text{Matching}}{\text{Cost}}$ and execute greedily within the daily 12-unit limit.
5. **Declined Handling**: Never issue queries for fields marked `'declined'`.

---

## 6. Empirical Baselines & Initial Benchmark Results

We evaluated the three supplied reference baselines across all six public scenario variants using identical public seeds ($101$) in full 60+40 day evaluation episodes.

### Scenario-Level Performance Comparison
| Baseline | Scenario | Arrived | Served | Coverage | Ask Cost | Mutual Acc. | Dates | MSMI | MSMI/100 | Runtime |
|---|---|---|---|---|---|---|---|---|---|---|
| **Greedy** | `development` | 200 | 92 | 46.0% | 198 | 18 | 15 | 1 | 0.50 | 23.2s |
| **Greedy** | `sparse` | 200 | 35 | 17.5% | 192 | 4 | 3 | 0 | 0.00 | 19.7s |
| **Greedy** | `cold_start` | 200 | 87 | 43.5% | 246 | 15 | 14 | 1 | 0.50 | 18.7s |
| **Greedy** | `delayed` | 200 | 91 | 45.5% | 198 | 19 | 16 | 2 | 1.00 | 18.1s |
| **Greedy** | `shift` | 200 | 92 | 46.0% | 198 | 19 | 17 | 1 | 0.50 | 24.8s |
| **Greedy** | `drift` | 200 | 92 | 46.0% | 198 | 16 | 13 | 1 | 0.50 | 24.3s |
| **No-Clarification** | `development` | 200 | 43 | 21.5% | 0 | 6 | 5 | 1 | 0.50 | 29.4s |
| **No-Clarification** | `sparse` | 200 | 13 | 6.5% | 0 | 2 | 2 | 0 | 0.00 | 34.7s |
| **No-Clarification** | `cold_start` | 200 | 24 | 12.0% | 0 | 6 | 4 | 0 | 0.00 | 22.7s |
| **No-Clarification** | `delayed` | 200 | 43 | 21.5% | 0 | 7 | 6 | 1 | 0.50 | 21.6s |
| **No-Clarification** | `shift` | 200 | 43 | 21.5% | 0 | 7 | 6 | 1 | 0.50 | 19.8s |
| **No-Clarification** | `drift` | 200 | 43 | 21.5% | 0 | 6 | 5 | 1 | 0.50 | 19.3s |
| **Random-Feasible** | `development` | 200 | 93 | 46.5% | 198 | 16 | 15 | 0 | 0.00 | 27.1s |
| **Random-Feasible** | `sparse` | 200 | 35 | 17.5% | 192 | 3 | 2 | 0 | 0.00 | 40.2s |
| **Random-Feasible** | `cold_start` | 200 | 88 | 44.0% | 246 | 13 | 13 | 1 | 0.50 | 27.5s |
| **Random-Feasible** | `delayed` | 200 | 92 | 46.0% | 198 | 18 | 15 | 1 | 0.50 | 23.8s |
| **Random-Feasible** | `shift` | 200 | 93 | 46.5% | 198 | 14 | 11 | 1 | 0.50 | 21.3s |
| **Random-Feasible** | `drift` | 200 | 93 | 46.5% | 198 | 16 | 15 | 0 | 0.00 | 20.5s |

### Overall Summary & Official Ranking Keys
| Method | Primary Score (MSMI / 100) | Overall Coverage | Mutual Accept / 100 | Mean Ask Cost | Mean Inference (s) |
|---|---|---|---|---|---|
| **Greedy Baseline** | **0.50** | **40.8%** | **7.58** | 205.0 | 21.44s |
| **No-Clarification** | **0.33** | **17.4%** | **2.83** | **0.0** | 24.57s |
| **Random-Feasible** | **0.25** | **41.2%** | **6.67** | 205.0 | 26.73s |

### Key Empirical Findings
1. **Clarification is Essential for Viability**: With zero clarification (`no_asks`), coverage collapses from $40.8\%$ to $17.4\%$, and MSMI drops to $0.00$ in `cold_start` and `sparse`. Clarification unlocks the feasibility graph.
2. **Quality vs. Pure Volume**: `random` achieves identical coverage to `greedy` (~41%) by spending the same budget on asks, but achieves half the primary score ($0.25$ vs $0.50$) because introductions lack compatibility guidance.
3. **Geography is the Primary Bottleneck**: In `sparse`, all baselines score $0.00$ MSMI and coverage drops below $18\%$, revealing that spatial fragmentation requires dedicated algorithmic handling.

---

## 7. Public Training Pool Inspection & Missingness Statistics

We analyzed all 1,200 members across the six designated training pools (`public_01` to `public_06`) at the day 30 snapshot:

```
Distribution of Missing Hard Fields per Person:
[ 0 missing fields ]: ████████████████████████████████ 787 members (65.6%)
[ 7-8 missing fields]: █ 23 members (1.9%)
[ 9-11 missing fields]: █████████ 390 members (32.5%)
```

* **Overall Hard Field Missingness**: 
  * Total hard-field instances: $13,200$
  * `observed`: $9,066$ ($68.68\%$)
  * `not_asked`: $3,563$ ($26.99\%$)
  * `declined`: $571$ ($4.33\%$)
  * Total unobserved: $4,134$ ($31.32\%$)
* **Bimodal Missingness Structure**:
  * 787 members ($65.6\%$) have fully completed hard profiles ($0$ missing fields).
  * 390 members ($32.5\%$) have almost completely missing profiles ($9$ to $11$ missing fields).
  * 413 members ($34.4\%$) have at least one permanently `declined` hard field.
* **Severe Graph Sparsity**:
  * **Mean feasible pairs per person in a pool of 200**: only **$1.01$** (median: $0$, min: $0$, max: $17$).
  * **$62.8\%$ of members have ZERO feasible pairs** in their entire pool under current observations!
  * In contrast, an average of **$25.15$ pairs per member** are in `needs_clarification` status, proving that targeted clarification is the single highest-leverage mechanism to expand the feasible graph.

---

## 8. Planned Experiments & Hypothesis-Driven Ablations

In Round 2, we will execute systematic evaluations across multiple seeds ($101, 102, 103$) and all six scenarios:

```
                      Experimental Plan Matrix
  ┌──────────────────────────────────────────────────────────────┐
  │                    Ablation 1: Allocation                    │
  │     Global Max-Weight Matching   vs.   Greedy Pair Ranking   │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
  ┌──────────────────────────────┴───────────────────────────────┐
  │                   Ablation 2: Clarification                  │
  │   Targeted EVOI Asks   vs.   Blind Static Asks   vs.   No Asks│
  └──────────────────────────────┬───────────────────────────────┘
                                 │
  ┌──────────────────────────────┴───────────────────────────────┐
  │                     Ablation 3: Patience                     │
  │     Thresholded Patient Matching  vs.  Immediate Allocation  │
  └──────────────────────────────────────────────────────────────┘
```

1. **Ablation 1 (Matching Formulation)**: Fix clarification strategy to Targeted EVOI; compare Global Max-Weight Matching vs. Greedy Pair Ranking.  
   *Metric of Validation*: Higher aggregate MSMI and higher coverage per episode.
2. **Ablation 2 (Clarification Strategy)**: Fix allocation to Global Matching; compare Targeted EVOI vs. Baseline Blind Queue vs. No Clarification.  
   *Metric of Validation*: Higher MSMI per clarification unit spent (clarification efficiency).
3. **Ablation 3 (Patience Threshold θ)**: Evaluate immediate assignment ($\theta = 0$) vs. tenure-dependent thresholded matching ($\theta > 0$).  
   *Metric of Validation*: Reduction in low-compatibility introductions and increased late-horizon MSMI.

---

## 9. Expected Failure Modes & Risk Mitigations

| Failure Mode | Root Cause in Simulator | Algorithmic Mitigation |
|---|---|---|
| **Spatial Isolation (`sparse`)** | 12 disconnected zones; severe candidate deficits in low-density zones | Patient waiting for cross-zone arrivals; prioritize multi-zone candidates (`acceptable_zones` length 2). |
| **Irrecoverable Declines** | 34.4% of candidates have declined hard fields, preventing validation | Detect unresolvable candidates early; prune them from query queues to eliminate wasted ask budget. |
| **Concurrency Lockout** | Candidates remain occupied for 15–20 days after an introduction | Model cycle latency explicitly; avoid pairing high-centrality candidates with low-probability responders. |
| **Preference Distribution Shift (`shift` / `drift`)** | Relative importance of soft attributes inverts or changes at day 35 | Maintain online moving-average logistic feedback models; weight recent feedback over initial priors. |
| **Candidate Monopolization** | Universally attractive candidates targeted by multiple potential matches | Global maximum weight matching natively distributes candidates to maximize total system utility. |

---

## 10. Product Integration & Ethical Governance Note (Vouchsafe)

This decision policy is engineered as an **auditable decision-support engine** for Vouchsafe, not an autonomous agent.

* **Explicit Consent & Human Agency**: The engine outputs recommendations with structured rationale; it never initiates contact, commits members, or bypasses member authorization. Introductions require affirmative, uncoerced double opt-in.
* **Explainability & Auditing**: Every proposed match carries human-readable justification vectors:
  > *"Candidate A and B share verified weekend evening schedules, mutual long-term relationship goals, and compatible geographic preferences. No hard constraints violated."*
* **Data Minimization & Privacy Protection**: In compliance with consent principles, the policy requests only attributes strictly necessary to establish eligibility. When a member marks a field `'declined'`, the refusal is treated as immutable—no synthetic imputation, indirect inference, or behavioral profiling is permitted.
* **Assumptions Requiring Real-World Validation**:
  1. *Immediate Truth Disclosure*: Real members may experience hesitation, recall bias, or evolving preferences rather than instantaneous questionnaire responses.
  2. *Deterministic Outcome Windows*: Fixed 7-day acceptance and 3-day feedback windows reflect idealized mechanics; real-world workflows require asynchronous, tolerant reminder cadences.
  3. *Synthetic Demographic Distributions*: Real population distributions exhibit nuanced demographic and geographic clustering that requires local calibration before production deployment.
