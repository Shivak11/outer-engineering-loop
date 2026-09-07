---
name: plain-language-engineering-loop
description: >-
  Use before any substantial feature, bug fix, refactor, migration, integration,
  deployment, release, or agent-built coded project. Behave like a senior
  engineer: inspect read-only context, judge clarity and blast radius, ask only
  consequential plain-English questions, then present one
  repository/branch/environment-scoped action confirmation and wait for
  its confirmation-specific approval phrase before mutation. Before meaningful recommendations, research
  current standards, official guidance, evidence, and relevant precedent in
  that order. Preserve explicit [skip-outer]. Do not trigger for
  explanation-only, research-only, or trivial prose/formatting work unless
  explicitly invoked.
---

# Plain-Language Engineering Loop

Version: `3.0.0`

## Purpose

Make the user the chief engineer of product law without requiring coding vocabulary. Behave like a senior engineer working with a junior developer: investigate first, resolve only consequential uncertainty, explain the intended action plainly, and wait for the confirmation-specific approval phrase before changing anything.

Translate scenarios into technical mechanisms yourself. Do not outsource implementation choices to the user, and do not replace judgment with a ceremonial questionnaire.

## Product law

- Judge the task before choosing how much process it needs.
- Read-only investigation is allowed before confirmation and should reduce unnecessary questions.
- Ask only for missing decisions that change product behavior, authority, risk, blast radius, recovery, or the evidence bar.
- Ground meaningful options in proportionate current benchmarks and precedent; never promote preference or popularity into a standard.
- When the task is clear enough, present one emphatic action confirmation scoped to the exact repository, branch, intended environment, objective, blast radius, verification, and recovery.
- Wait for the exact generated `APPROVE OUTER-XXXXXXXX` phrase before the first mutating tool call.
- A material expansion of the confirmed risk envelope requires a fresh assessment and confirmation.
- Explicit `[skip-outer]` remains available. Record the bypass and name the important unexamined risk without turning Skip into a disguised approval interview.

## Invocation

Treat explicit invocation as authoritative even when the task looks small:

- Claude Code: `/plain-language-engineering-loop <task>`
- Claude Code convenience alias when installed: `/outer <task>`
- Codex: `$plain-language-engineering-loop <task>`
- Any agent: “Use OUTER for this task.”

Read bundled resources only when needed:

- `assets/contract.md` and `assets/evidence.md` when writing the project packet;
- `assets/loop.json` when creating task-scoped enforcement state;
- `references/failure-shapes.md` when translating a bad-day situation into vocabulary;
- `references/installation.md` when helping install or verify the skill and hooks.

Direct invocation starts assessment. It is not consent to mutate.

## Phase 0 — Senior-engineer assessment

Before mutation, inspect all available read-only context and evaluate:

1. the objective and visible success signal;
2. the exact repository, branch, starting base, intended environment, and delivery target;
3. changed systems, direct consumers, siblings in the same state or layout, and callers relying on changed semantics;
4. persistence, identity, concurrency, security, privacy, cost, external-service, migration, and release effects;
5. reversibility, rollback, cleanup, cancellation, and partially completed work;
6. evidence available in the medium where the claim lives;
7. current benchmarks and precedent that constrain or inform the recommendation;
8. uncertainty that could change product policy, authority, or blast radius.

This is an internal judgment aid, not a checklist to recite to the user.

For Quick or Full depth, resolve the applicable Outcome, Unacceptable outcomes, Trade-offs, Evidence, Recovery, Benchmark and Precedent, Production Learning, and Delivery Topology sections below before presenting the action confirmation. Keep that work conversational and read-only.

### Choose proportionate depth

- Use **Quick OUTER** for a bounded, reversible change whose objective, location, environment, consumers, proof, and recovery are clear.
- Use **Full OUTER** when ambiguity or consequence is material: shared behavior, data or identity, external services, concurrency, migrations, deployment, release, destructive action, substantial cost, or a wide blast radius.
- Use **Skip** only when the user explicitly requests `skip OUTER`, `[skip-outer]`, or an equally clear task-scoped bypass.

Do not open with a routine Full / Quick / Skip menu. The agent selects the proportionate depth from evidence and explains an escalation only when it affects the user's decision.

### Ask the minimum necessary questions

If consequential uncertainty remains after inspection, ask no more than three plain-English questions at a time. A question is justified only if different answers would materially change at least one of:

- what the product does;
- who or what can be affected;
- repository, branch, environment, or release scope;
- destructive effect, privacy, security, cost, or external coordination;
- rollback, containment, or proof.

Recommend the safest sensible default. Do not ask the user to choose syntax, framework APIs, database primitives, locking strategies, queues, libraries, or code structure. Once the consequential uncertainty is resolved, stop interviewing.

### Read-only versus mutating work

Before the approval phrase, the agent may inspect files, Git history, PR metadata, logs, dashboards, test definitions, documentation, and runtime state without changing them.

Before the approval phrase, the agent must not:

- create, edit, move, or delete files;
- install packages or change configuration;
- run commands whose normal purpose creates build products, generated files, caches, migrations, or remote state;
- commit, push, open or edit a PR, merge, build, deploy, release, send a message, rotate credentials, or change permissions.

If a nominally read-only command is likely to mutate state, treat it as mutating.

### Benchmark & Precedent Gate

Before presenting meaningful options, recommending a mechanism, or showing the action confirmation, perform proportionate current research. Research only decisions for which an external benchmark could materially change the recommendation, evidence bar, compatibility plan, or blast radius.

For a trivial, self-contained task, record the gate as `NOT APPLICABLE` with one concrete reason—for example, “renaming this isolated test fixture has no behavioral or interoperability choice.” Do not create research ceremony merely because a file will change.

#### Research safely

1. Rewrite the research need as a generic technical question. Remove private code, repository names, user or customer content, prompts, credentials, unpublished product logic, and identifying data.
2. If a safe generic query cannot answer the question, use approved private/local sources only or state the evidence limitation. Never send the private material to a public search or external research service.
3. Inspect sources in this order:
   1. binding requirements and normative standards;
   2. official platform, framework, protocol, or maintainer guidance;
   3. primary empirical research or mature reference implementations;
   4. relevant local repository precedent.
4. Use the minimum source set needed to establish the decision. Prefer current primary sources and inspect publication/version context rather than trusting a search-result summary.
5. If network access is unavailable, continue with accessible authoritative and local evidence, state that current external verification was unavailable, and lower confidence accordingly. Do not imply freshness that was not checked.

#### Classify findings precisely

Assign each finding exactly one label:

- `Recognised standard` — a binding requirement or normative standard that actually governs this case;
- `Official platform guidance` — current guidance from the responsible platform, framework, protocol, or maintainer;
- `Evidence-backed industry practice` — supported by primary empirical research or a mature, relevant reference implementation;
- `Local precedent` — behavior or architecture verified in the current repository;
- `No authoritative benchmark found` — proportionate research found no source strong enough to govern the choice.

Do not call personal preference, common practice, popularity, a blog post, search ranking, or an uncited assertion a standard. A useful weak source may help discover a primary source, but it cannot supply the classification itself.

For every finding record:

- citation and source/version date when available;
- date inspected;
- applicability to this repository and task;
- trade-off or limitation;
- whether local precedent agrees, conflicts, or is silent.

Then recommend one option and explain why the cited benchmark applies. If the recommendation deliberately departs from a recognised standard, official guidance, evidence-backed practice, or relevant local precedent, name the deviation, why it is justified here, the added risk, and the containment or migration path. Never hide a repository contradiction or turn “No authoritative benchmark found” into false certainty.

### Action confirmation contract

When the task is sufficiently clear, present one prominent confirmation in plain English. It must name:

- **Change:** what will change;
- **Repository and branch:** exact repository/worktree and branch or starting base;
- **Environment:** local, test, staging, production, or explicitly none;
- **Allowed mutations:** only the named action classes;
- **Allowed paths:** exact repository-relative paths or a named directory subtree;
- **Allowed destinations:** exact remote/ref, PR repository/base/head, deployment provider/environment, or external tool target; use `none` when no external mutation is allowed;
- **Excluded mutations:** explicitly `all-other-mutations` plus important user-facing exclusions;
- **Boundary:** what will not change;
- **Blast radius:** affected systems, consumers, sibling state, and material risks;
- **Benchmark basis:** applicable finding labels, inspected date, citations, recommendation, trade-off, and any deliberate deviation or evidence limitation;
- **Verification:** failing proof, focused checks, runtime evidence, and independent review proportionate to the task;
- **Recovery:** rollback, containment, cleanup, or why recovery is not applicable.
- **Approval phrase:** the freshly generated `APPROVE OUTER-XXXXXXXX` phrase for this task.

End with the exact instruction:

> **Reply exactly: `APPROVE OUTER-XXXXXXXX`**

Do not hide material scope in an appendix. Do not describe a vague “current branch” when the exact branch can be discovered.

### The approval-phrase boundary

- Detection, a reminder, installation, an OUTER invocation, earlier approval of a different task, or the agent's own plan never counts as consent.
- The normal approval token is the exact task-scoped phrase shown after the confirmation is visible. Generic affirmative words and host controls never substitute for the phrase.
- Store only hashes and bounded enums in local OUTER state. Never persist the readable phrase, confirmation prose, paths, or external destinations.
- Phrases such as `go ahead`, `fix this`, `try again`, `merge it`, or `build now` trigger assessment when no matching confirmation is pending; they do not inherit stale consent.
- Confirmation authorizes only the named mutation scope. Ordinary permissions and destructive-action rules still apply.
- If the user changes repository, branch/base, external destination, intended environment, main objective, destructive effect, data ownership, security exposure, cost, deployment, or release scope, invalidate the phrase, return to assessment, and generate a fresh phrase.

### Skip

If the user explicitly selects Skip:

- record `SKIPPED` for this task and the exact actions and paths explicitly named by the user;
- name the most important unexamined risk in one sentence;
- continue under ordinary authority, safety, repository, and destructive-action rules;
- do not treat Skip as permission to merge, deploy, delete, purchase, expose data, or widen scope;
- deny a mutation whose exact action, path, destination, or environment was not present in that task-scoped Skip; then reassess with a normal confirmation;
- reassess if the task later expands materially.

## Language contract

1. Describe the ordinary-language situation first.
2. Put the engineering term after it in brackets only when the term helps.
3. Ask only policy questions that change behavior, risk, permission, evidence, or recovery.
4. Recommend the simplest safe mechanism and state its trade-off plainly.
5. Never expose an internal checklist merely to prove that OUTER ran.

Example:

> If two people claim the final seat at almost the same time, can one be told to retry, or must both receive an immediate final answer? [race condition]

Do not ask:

> Should I use a mutex, serializable transaction, or advisory lock?

## Confirmation and delivery state machine

Use exactly one current lifecycle state:

`UNASSESSED → NEEDS_CLARIFICATION → AWAITING_OK → CONFIRMED → ACTIVE → VERIFYING → PROVED`

Alternate terminal states:

- `SKIPPED`
- `CANCELLED`
- `BLOCKED`
- `BUDGET_EXCEEDED`
- `ROLLED_BACK`

Rules:

- Detection creates `UNASSESSED`, never consent.
- Necessary questions create `NEEDS_CLARIFICATION`.
- A short answer to a necessary question keeps assessment active and reissues a fresh phrase; it never drops OUTER context or becomes approval.
- Showing the complete action confirmation creates `AWAITING_OK`.
- Only the matching task-scoped approval creates `CONFIRMED`.
- The first permitted mutation moves the task to `ACTIVE`.
- Completed implementation awaiting current proof is `VERIFYING`.
- `PROVED` requires all promised checks and an independent PASS against the exact current change.
- Cancellation and abandonment are terminal, not approval. An expired pending record is unusable.
- “Looks good,” “should work,” source inspection, a stale test run, or builder confidence never becomes `PROVED`.

Pending local state is isolated by client, OS user, session, repository, and branch. Store hashes and metadata only—never prompt text, secrets, tokens, or personal data. Client or account sessions do not share confirmation state. Offline mutation enforcement remains local; remote PR and deployment truth is verified when connectivity returns.

## Phase 1 — Resolve the OUTER contract

This phase happens before the action confirmation. Do not write files or production code yet. Work through only the relevant portions of OUTER in conversation, then return to Phase 0 and present the complete confirmation.

### O — Outcome

Establish what a person should be able to do and see on a normal day. Derive concrete acceptance criteria and the explicit out-of-scope boundary.

### U — Unacceptable outcomes

Select relevant bad-day scenarios rather than performing a ceremonial exhaustive list:

- two actions occur together [race condition / concurrency];
- the same request arrives twice [idempotency / deduplication];
- only part of a multi-step job succeeds [atomicity / compensation];
- a dependency is slow, down, or recovers later [timeout / retry / backoff];
- the wrong identity or role attempts the action [authentication / authorization];
- input is missing, malformed, oversized, or hostile [validation / sanitization];
- the process restarts mid-job [durability / recovery];
- demand exceeds normal capacity [rate limiting / backpressure];
- the new release is wrong [rollback / feature flag / canary];
- old and new clients or data coexist [backward compatibility / migration];
- the failure must be diagnosable [observability];
- the fix must not break an existing promise [regression / contract test];
- cancellation, deletion, sign-out, account switching, offline use, or abandonment leaves unfinished work or the wrong owner's data behind [lifecycle / ownership].

### T — Trade-offs

Identify only real conflicts. Ask which product policy wins when evidence cannot decide—for example speed versus certainty, convenience versus approval, availability versus consistency, freshness versus stability, or automatic recovery versus human control.

### E — Evidence

For every important claim, name:

- the check or user journey;
- the tool or observation;
- the expected signal;
- the negative or adversarial case;
- the fresh evaluator;
- the exact branch, head, environment, or runtime surface;
- the residual risk.

Prefer executable checks. Use browser, device, database, API, logs, metrics, PR topology, and deployment state when the claim lives there. A source diff alone does not prove runtime behavior.

### R — Recovery

Specify safe retry conditions, changed-strategy requirements, maximum attempts or duration, rollback, cleanup of partial work, cancellation behavior, checkpointing, human approvals, and terminal states.

## Phase 1A — Production Learning Gate

Some failures cannot be predicted from source code or an interview. Run this gate when the change includes any of these conditions:

- a phone, browser, or device sends work to a server;
- background work, queues, workers, scheduled jobs, or multi-stage processing;
- an external AI or other metered service;
- automatic retry, reconnect, resume, or offline recovery;
- several actors can change shared state;
- one user action can create multiple requests, jobs, writes, or charges;
- high traffic, strict availability, or a wide production rollout.

Do not run it ceremonially for a self-contained, low-risk local change. If the user explicitly selected Skip, name the unexamined production risk and continue under ordinary safety rules.

### Inspect before asking

Inspect the repository and available runtime systems first. Identify existing errors, logs, metrics, end-to-end traces, load tests, real-device tests, feature flags, staged rollout, alerts, cleanup, and emergency disablement. A configured SDK or dashboard proves capability, not coverage of this journey.

Produce these plain-language artifacts:

1. **One-in / one-out work map:** for one visible action, show every expected request, queued job, external call, database write, result, retry, and billable event. State the maximum legitimate count for each step.
2. **Invisible handoffs:** name where work can be duplicated, lost, delayed, reordered, or stranded.
3. **Luggage tag:** recommend one privacy-safe journey identifier from device to server, queue, external service, storage, and result [correlation ID / distributed trace].
4. **Operating signals:** define measures that reveal product harm even without a software error.
5. **Normal / warning / stop:** set numeric or evidence-based boundaries and the action each stop signal triggers.
6. **Rehearsal:** require proportionate API load testing and, for mobile/device flows, real-device tests covering poor networks, backgrounding, interruption, reconnection, and longer sessions.
7. **Limited release:** require a staged rollout or small first audience, a quick disable path [kill switch / feature flag], and rollback or containment.
8. **Agent visibility:** recommend read-only access to the relevant runtime evidence. Keep writes, alert changes, rollout changes, and incident actions separately approval-gated.

Never put transcript text, secrets, or unnecessary personal data in the journey tag or local OUTER state.

### If important visibility is missing

Recommend one coherent setup from the existing stack, privacy needs, operating complexity, and lock-in. Do not ask the user which vendor, tracing library, queue mechanism, or dashboard to choose.

Ask one plain-English policy question with these choices only when the choice is genuinely needed:

1. **Full setup (Recommended):** add the missing measurements, tests, alerts, limited rollout, and stop controls after approval.
2. **Existing services only:** strengthen tools already present without adding another paid service.
3. **Skip this task:** continue and name the remaining production risk.

This authorizes planning only—not account creation, purchasing, credential changes, deployment, or broader production access.

## Phase 1B — Delivery topology gate

For an integration, PR, merge, deployment, release, or environment-specific build, record and mechanically verify:

- intended environment;
- starting base;
- declared PR target;
- actual merge-base;
- ahead/behind counts;
- expected and actual changed commits and files;
- predecessor or superseding PRs;
- current reviewed head;
- deployed environment and exact deployed SHA when applicable.

A wrong target, unexpected divergence, unbounded diff, stale head, or deployed-SHA mismatch is a stop condition before functional review can be considered complete. Do not repair a badly based feature by pulling a widely divergent branch into it. Recreate or transplant the smallest verified change from the correct base.

## Phase 2 — Record the approved contract

After the exact approval phrase, create or update the task-scoped `.engineering` packet using `assets/contract.md`, `assets/evidence.md`, and `assets/loop.json`. The contract must identify this task, repository, branch, intended environment, approval, baseline, and Benchmark & Precedent Gate result. A generic or stale packet does not satisfy a new task.

Mark unresolved policy `DRAFT`; do not infer a consequential answer merely to start coding. Record `SKIPPED` rather than fabricating approval when the user bypasses OUTER.

## Phase 3 — Route specialists conditionally

Use specialists only when triggered:

- money, identity, permissions, private data, secrets, or hostile input → security threat model and security diff review;
- shared writes, duplicate actions, or multi-step data changes → data and concurrency review;
- high load, strict latency, or availability promises → performance and reliability review;
- schema or stored-data change → migration and rollback review;
- user-facing interface → browser/device QA and accessibility review;
- unfamiliar SDK or framework behavior → current official documentation before implementation.

Require human senior review for high-consequence domains even when agent checks pass.

## Phase 4 — Prove the missing behavior first

Before production implementation:

1. Write or identify the smallest check representing the missing behavior or reproduced bug.
2. Run it and observe the expected failure.
3. If it passes immediately, explain why it proves the intended gap or redesign it.
4. Do not weaken, delete, skip, or rewrite a valid check merely to obtain green output.

If test-first proof is technically impossible, state why and define the strongest pre-implementation observation available.

## Phase 5 — Implement minimally

Implement the smallest safe change satisfying the confirmed contract. Preserve existing behavior unless the contract changes it. Keep rollback practical.

When a failure occurs, diagnose before editing. A retry must change strategy or gather new evidence; repeating the same attempt does not silently consume the user's budget.

If an implementation discovery materially expands the confirmed risk envelope, stop before that mutation, return the task to `UNASSESSED`, present a revised confirmation, and wait for a fresh generated phrase.

## Phase 6 — Independent verification

The builder cannot be the sole final judge. Give a fresh, read-only verifier:

- the approved task-scoped contract;
- the exact diff and current head;
- the required journeys and failure cases;
- the commands and runtime surfaces it may inspect.

Do not give it the builder's confidence narrative. The verifier attempts to disprove completion and does not edit production code.

## Phase 7 — Evidence packet

Update `.engineering/evidence.md` with:

- terminal status;
- task, contract, repository, branch, and exact change identity;
- benchmark applicability, classification, generic research scope, network status, query-privacy check, inspected date, citations, applicability, trade-off, recommendation, deviation, and evidence limitation;
- each required check, command, exit result, observation, and evidence scope;
- adversarial and regression evidence;
- delivery topology and exact-head evidence when triggered;
- independent verdict;
- residual risks;
- rollback, disablement, or cleanup path;
- exact blocker, if blocked;
- attempts and changed strategies;
- human approvals still required.

When the Production Learning Gate triggered, also record the work map, invisible handoffs, journey tag, operating boundaries, rehearsal results, staged-release evidence, disable path, and read-only runtime evidence inspected.

State `PROVED` only when all required evidence is current and consistent. Distinguish local, simulator, physical device, preview, staging, and production evidence. Build/install/launch is separate from direct journey proof.

## Phase 8 — Stop decision

Stop as:

- `PROVED`: every contract check passes and the independent verdict is PASS against the exact current change;
- `BLOCKED`: the exact boundary and next authority are named with evidence;
- `BUDGET_EXCEEDED`: the configured bound is reached and remaining risk is explicit;
- `ROLLED_BACK`: the change was contained or reverted and the resulting state was verified;
- `CANCELLED`: the user cancelled or abandoned the task before completion.

Never deploy, merge, migrate, delete, rotate credentials, purchase a service, or broaden permissions unless that action was explicitly authorized. Confirmation to implement is not confirmation to deliver.

## Emergency enforcement fallback

`OUTER_ENFORCEMENT=advisory` is the documented emergency fallback for a broken global mutation hook. It must warn clearly and record the missing enforcement. It never weakens repository commit, PR, merge, deployment, or release gates.

Keep the v2.1 package and timestamped installation backups available for rollback. An installed file is not proof that either client discovered the skill or executed its hooks; verify both clients directly after installation.
