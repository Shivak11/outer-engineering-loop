#!/usr/bin/env node

import {
  approvalPhraseFromPrompt,
  approvalPhraseHash,
  bypassEnvelopeFromPrompt,
  createApprovalPhrase,
  hookEventName,
  mergeScopeMeta,
  privacyHash,
  promptFromInput,
  promptHash,
  readJsonInput,
  readState,
  respondJson,
  scopeMetaFromText,
  writeState
} from "./outer-state.mjs";

const input = await readJsonInput();
const event = hookEventName(input);
const prompt = promptFromInput(input);

if (!prompt || (event && event !== "UserPromptSubmit")) {
  respondJson();
  process.exit(0);
}

const normalized = prompt.toLowerCase().replace(/\s+/g, " ").trim();
const explicitInvocation = /(?:^|\s)(?:\/outer|\/plain-language-engineering-loop|\$plain-language-engineering-loop)\b/i;
const skipMarker = /\[skip-outer\]|\bskip[ -]?outer\b|\bouter\s*:\s*off\b/i;
const suppliedApprovalPhrase = approvalPhraseFromPrompt(prompt);
const genericApproval = /^(?:ok|okay|approved?|proceed|go ahead)[.!?]*$/i;
const cancellation = /^(?:cancel|stop|never mind|nevermind)(?:[,.!]|\s|$)/i;
const contextualMutation = /^(?:go ahead|go ahead and .+|try again|try now|fix this(?: now)?|merge it|merge \d+.+|build now|rebuild(?: it)?|raise (?:the|a) pr|do it|proceed with (?:it|this))\.?$/i;
const actionWords = /\b(build|create|make|implement|add|change|update|fix|refactor|rewrite|migrate|integrate|deploy|release|ship|redesign|replace|upgrade|install|configure|automate|set\s*up|rotate|delete|remove|flush|grant|merge|push|commit|rebuild)\b/i;
const inherentlyEngineeringAction = /\b(implement|refactor|rewrite|migrate|integrate|deploy|release|upgrade|merge|push|commit|rebuild)\b/i;
const engineeringObjects = /\b(app|application|feature|bug|code|codebase|repo|repository|api|database|schema|auth|authentication|authorization|payment|service|backend|frontend|mobile|website|pipeline|migration|integration|deployment|test|worker|server|hook|skill|agent|config|configuration|cli|sdk|queue|job|endpoint|build|branch|pull request|pr)\b/i;
const highConsequence = /\b(payment|money|billing|credential|secret|permission|personal data|private data|migration|delete data|production database|public api|medical|legal|safety-critical|production|staging|deploy|release|merge|push)\b/i;
const readOnlyLead = /^(?:explain|research|benchmark|compare|inspect|review|check|investigate|diagnose|look at|look for|find precedents?|find industry examples?|can you check|tell me|show me|find out|audit|critique|criti[cs]ise|assess|evaluate|watch|summari[sz]e)\b/i;

let prior = readState(input);
const activeApproval = ["CONFIRMED", "ACTIVE"].includes(prior.record?.lifecycle)
  && Boolean(prior.record?.confirmationEnvelope?.envelopeHash);

if (suppliedApprovalPhrase) {
  const suppliedHash = approvalPhraseHash(suppliedApprovalPhrase);
  const armed = prior.record?.lifecycle === "AWAITING_OK"
    && prior.record?.confirmationEnvelope?.envelopeHash
    && prior.record?.confirmationEnvelope?.assistantTurnHash
    && prior.record?.confirmationEnvelope?.approvalPhraseHash === suppliedHash;
  const expansionArmed = ["CONFIRMED", "ACTIVE"].includes(prior.record?.lifecycle)
    && prior.record?.pendingConfirmationEnvelope?.envelopeHash
    && prior.record?.pendingConfirmationEnvelope?.assistantTurnHash
    && prior.record?.pendingConfirmationEnvelope?.approvalPhraseHash === suppliedHash;
  if (armed || expansionArmed) {
    const saved = writeState(input, {
      ...prior.record,
      lifecycle: "CONFIRMED",
      confirmationEnvelope: expansionArmed
        ? prior.record.pendingConfirmationEnvelope
        : prior.record.confirmationEnvelope,
      pendingConfirmationEnvelope: null,
      pendingApprovalPhraseHash: ""
    });
    respondJson({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: saved.error
          ? "OUTER v3 could not persist confirmation. Continue read-only and explain that mutation remains unavailable until state storage recovers."
          : "OUTER v3 confirmation recorded for this client, session, repository, branch, task-specific phrase, and approved risk envelope. Mutation may begin. Reassess and issue a fresh phrase if scope expands."
      }
    });
    process.exit(0);
  }
  const somethingArmed = (prior.record?.lifecycle === "AWAITING_OK" && prior.record?.confirmationEnvelope?.envelopeHash)
    || activeApproval
    || Boolean(prior.record?.pendingConfirmationEnvelope?.envelopeHash);
  if (somethingArmed) {
    respondJson({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "OUTER v3: this phrase does not match any armed confirmation. Existing approvals and pending confirmations are preserved unchanged. If the user meant to approve, ask them to retype the exact phrase shown at the end of the rendered confirmation; do not mutate on the strength of this reply."
      }
    });
    process.exit(0);
  }
  const replacementPhrase = createApprovalPhrase();
  const replacement = prior.record
    ? writeState(input, {
      ...prior.record,
      lifecycle: "UNASSESSED",
      confirmationEnvelope: null,
      pendingConfirmationEnvelope: null,
      pendingApprovalPhraseHash: approvalPhraseHash(replacementPhrase)
    })
    : { error: null };
  respondJson({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: replacement.error
        ? "OUTER v3 rejected this stale or unarmed approval phrase and could not persist a replacement challenge. Continue read-only until state storage recovers."
        : `OUTER v3 rejected this stale or unarmed approval phrase. Continue read-only and render a fresh complete confirmation using this new exact phrase: ${replacementPhrase}`
    }
  });
  process.exit(0);
}

if (cancellation.test(normalized) && prior.record) {
  writeState(input, {
    ...prior.record,
    lifecycle: "CANCELLED",
    pendingConfirmationEnvelope: null,
    pendingApprovalPhraseHash: ""
  });
  respondJson({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "OUTER v3 marked this task cancelled. Do not mutate for it; read-only inspection remains available."
    }
  });
  process.exit(0);
}

if (genericApproval.test(normalized) && prior.record?.lifecycle === "AWAITING_OK" && prior.record?.confirmationEnvelope?.envelopeHash) {
  respondJson({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "OUTER v3: generic approval words do not arm mutation. The rendered confirmation stays armed; the user must reply with its exact approval phrase."
    }
  });
  process.exit(0);
}

if (activeApproval && (genericApproval.test(normalized) || contextualMutation.test(normalized))) {
  respondJson({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "OUTER v3: an approved confirmation is already active for this task and remains armed. Continue within its exact envelope; render an expansion confirmation only if new scope is actually needed."
    }
  });
  process.exit(0);
}

// 2026-08-04 amendment: design-artifact-only asks (critiques, mocks,
// wireframes) are not code fixes and never arm the gate unless the prompt
// also commissions delivery (implement/commit/push/merge/deploy/PR).
const designArtifactOnly = /\b(?:mock(?:-?up)?s?|wireframes?|prototype|critique|storyboard|filmstrip|design review)\b/i.test(normalized)
  && !/\b(?:implement|commit|push|merge|deploy|release|ship|install|migrate|refactor|rebuild)\b/i.test(normalized)
  && !/\bpull request\b|\b(?:open|raise|create)\s+(?:a\s+|the\s+)?pr\b/i.test(normalized);
if (designArtifactOnly && !explicitInvocation.test(prompt) && !skipMarker.test(prompt)) {
  respondJson();
  process.exit(0);
}

const promptScope = scopeMetaFromText(prompt);
const direct = explicitInvocation.test(prompt);
const contextual = contextualMutation.test(normalized);
const hasChangeAction = actionWords.test(normalized);
const likelyEngineeringChange = direct || contextual || inherentlyEngineeringAction.test(normalized) || (
  hasChangeAction && (engineeringObjects.test(normalized) || highConsequence.test(normalized))
);

let invalidatedPending = false;
if (prior.record?.lifecycle === "AWAITING_OK" && likelyEngineeringChange) {
  const invalidated = writeState(input, {
    ...prior.record,
    lifecycle: "UNASSESSED",
    taskHash: promptHash(prompt),
    scopeMeta: mergeScopeMeta(prior.record.scopeMeta, promptScope),
    confirmationEnvelope: null,
    pendingConfirmationEnvelope: null,
    pendingApprovalPhraseHash: ""
  });
  invalidatedPending = !invalidated.error;
  prior = invalidated.error ? prior : readState(input);
}

if (skipMarker.test(prompt)) {
  const bypassEnvelope = bypassEnvelopeFromPrompt(input, prompt, promptScope);
  const saved = writeState(input, {
    lifecycle: "SKIPPED",
    taskHash: promptHash(prompt),
    scopeMeta: promptScope,
    confirmationEnvelope: null,
    bypassEnvelope,
    bypassRiskHash: privacyHash("user-selected-skip-with-unexamined-risk")
  });
  respondJson({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: saved.error
        ? "OUTER v3 skip was requested but could not be recorded. Continue read-only until state storage recovers."
        : "OUTER v3 bypass recorded for this exact task and risk envelope. State the unexamined risk before mutation. The bypass does not authorize later scope expansion."
    }
  });
  process.exit(0);
}

const approvalWithoutArmedConfirmation = genericApproval.test(normalized) || Boolean(suppliedApprovalPhrase);
const assessmentInProgress = prior.record && ["UNASSESSED", "NEEDS_CLARIFICATION"].includes(prior.record.lifecycle);
if ((!likelyEngineeringChange && !invalidatedPending && !approvalWithoutArmedConfirmation && !assessmentInProgress)
  || (readOnlyLead.test(normalized) && !hasChangeAction && !assessmentInProgress)) {
  respondJson();
  process.exit(0);
}

const existingScope = prior.record?.scopeMeta;
const combinedScope = mergeScopeMeta(existingScope, promptScope);
const approvalPhrase = createApprovalPhrase();
const saved = writeState(input, {
  ...prior.record,
  lifecycle: activeApproval ? prior.record.lifecycle : "UNASSESSED",
  taskHash: promptHash(prompt),
  scopeMeta: combinedScope,
  confirmationEnvelope: activeApproval ? prior.record.confirmationEnvelope : null,
  pendingConfirmationEnvelope: null,
  pendingApprovalPhraseHash: approvalPhraseHash(approvalPhrase)
});

const confirmationRequirements = [
  "Present a markdown heading 'OUTER action confirmation' followed by one single-line field for each exact label: Change, Repository, Branch, Environment, Allowed mutations, Allowed paths, Allowed destinations, Excluded mutations, Boundary, Blast radius, Benchmark basis, Verification, Recovery, Approval phrase.",
  "Allowed mutations must use only these comma-separated tokens: edit-files, delete-files, run-tests, build, commit, push, open-pr, merge, deploy, install, external-write, delegate-write, interactive-write, shell-write.",
  "Allowed paths must list exact repository-relative paths or a directory ending in /**. Use none only when no filesystem action is allowed. Excluded mutations must include all-other-mutations.",
  "Allowed destinations must use canonical exact values such as git-push:origin:feature/name, github-pr-create:owner/repo:staging:feature/name, deploy:vercel:production, or tool:mcp__slack__post_message|channel=team-updates. Use none only when no external mutation is allowed.",
  `Set Approval phrase exactly to: ${approvalPhrase}`,
  `End exactly: Reply exactly: ${approvalPhrase}`
].join(" ");

let additionalContext;
if (saved.error) {
  additionalContext = "OUTER v3 detected likely mutation but could not persist its task state. Continue read-only only and explain that mutation is fail-closed until state storage recovers.";
} else if (activeApproval) {
  additionalContext = `OUTER v3 detected a new or expanded task while an approved confirmation is active. The existing approval remains armed and valid for its exact scope; out-of-scope actions stay blocked. To take on the new scope, render an expansion confirmation covering the union of the approved and new scope. ${confirmationRequirements}`;
} else if (approvalWithoutArmedConfirmation || invalidatedPending || (prior.record && ["UNASSESSED", "NEEDS_CLARIFICATION"].includes(prior.record.lifecycle))) {
  additionalContext = `OUTER v3 has no armed approval. A prior confirmation was invalidated, a generic approval was rejected, or this task is still unassessed. Continue read-only if useful and resolve consequential uncertainty. ${confirmationRequirements}`;
} else {
  additionalContext = [
    "OUTER v3 applies before mutation.",
    "Act like a senior engineer working with the user in plain English: judge objective clarity, repository and branch, environment, blast radius, reversibility, and the evidence required in the medium where the claim lives.",
    "If consequential uncertainty remains, ask only the smallest questions needed.",
    `Otherwise ${confirmationRequirements}`,
    "The host Stop hook arms that rendered confirmation. Do not mutate until the following user turn copies that exact phrase. Generic approval words do not count. Read-only investigation remains allowed."
  ].join(" ");
}

respondJson({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext
  }
});
