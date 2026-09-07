# Failure Shapes In Ordinary Language

Use this reference after the user understands the situation. The technical term is a retrieval handle, not the question the user must answer.

| Ordinary-language situation | Engineering vocabulary | Proof shape |
|---|---|---|
| Two people or processes act on the same thing together | race condition, concurrency | repeat simultaneous actions and inspect the final state |
| The same request arrives twice | idempotency, deduplication | repeat the identical request and verify one real-world effect |
| One visible action quietly creates many requests, jobs, writes, or charges | request amplification, fan-out | count every downstream effect per user action and enforce a maximum |
| A retry creates more work before the earlier attempt is known to have failed | retry storm, overlapping retry | make the dependency slow and verify retries remain bounded and do not overlap harmfully |
| Work arrives faster than it can be processed | backpressure, queue saturation | push sustained load and verify controlled waiting, refusal, or degradation instead of collapse |
| The same item is processed by two workers | duplicate processing, idempotency | deliver the same job twice and verify one durable result and one charge |
| Work disappears between two stages and nobody finishes or repairs it | orphaned job, reconciliation | interrupt each handoff and verify detection, resumption, or safe repair |
| A phone backgrounds, reconnects, or changes network while work is active | mobile lifecycle, reconnect, resume | use a real device under interruption and verify bounded requests and one final result |
| A multi-step action fails halfway | atomicity, transaction, compensation | force a mid-process failure and verify all-or-nothing or safe repair |
| Another service becomes slow or unavailable | timeout, retry, backoff, circuit breaker | simulate delay/failure and verify bounded recovery and useful feedback |
| The system restarts mid-job | durability, checkpointing, recovery | interrupt and restart without silent loss, duplication, or corruption |
| The wrong person attempts an action | authentication, authorization, least privilege | test allowed and forbidden identities for each sensitive action |
| Input is malformed, hostile, or unexpectedly large | validation, sanitization, injection protection, limits | exercise invalid and adversarial input without damage |
| Demand rises sharply | capacity, rate limiting, backpressure, graceful degradation | push past normal load and verify controlled slowdown or refusal |
| Nobody can explain a failure afterward | observability, logs, metrics, traces | reproduce failure and identify its stage without exposing secrets |
| The system behaves harmfully but throws no software error | product telemetry, service-level indicator | cross a warning boundary such as excess work or cost and verify an alert or automatic stop |
| A release causes damage | rollback, feature flag, canary | disable or revert the change and verify service recovery |
| Old and new versions must coexist | backward compatibility, migration | test both versions through the transition |
| A fix breaks an old promise | regression, contract test | rerun the old behavior checks alongside the new proof |

## Consequence escalators

Recommend specialist and human review for money movement, identity or permissions, private data, shared-state writes, irreversible migration or deletion, cryptography, credential handling, public APIs, strict reliability targets, and regulated or safety-critical decisions.
