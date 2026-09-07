#!/usr/bin/env node

import {
  assistantMessageFromInput,
  confirmationEnvelopeFromMessage,
  hookEventName,
  readJsonInput,
  readState,
  respondJson,
  writeState
} from "./outer-state.mjs";

const input = await readJsonInput();
const event = hookEventName(input);
if (event && event !== "Stop") {
  respondJson();
  process.exit(0);
}

const prior = readState(input);
const lifecycle = prior.record?.lifecycle;
const expansionPending = ["CONFIRMED", "ACTIVE"].includes(lifecycle)
  && Boolean(prior.record?.pendingApprovalPhraseHash);
if (
  prior.error
  || prior.expired
  || !prior.record
  || (!["UNASSESSED", "NEEDS_CLARIFICATION"].includes(lifecycle) && !expansionPending)
) {
  respondJson();
  process.exit(0);
}

const parsed = confirmationEnvelopeFromMessage(
  input,
  assistantMessageFromInput(input),
  prior.record.pendingApprovalPhraseHash
);
if (!parsed.envelope && !parsed.error) {
  respondJson();
  process.exit(0);
}

if (parsed.error) {
  respondJson({
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: parsed.error + " Re-render the complete confirmation with the required exact labels and the generated task phrase; do not claim that approval is pending yet."
    }
  });
  process.exit(0);
}

const saved = writeState(input, expansionPending
  ? { ...prior.record, pendingConfirmationEnvelope: parsed.envelope }
  : { ...prior.record, lifecycle: "AWAITING_OK", confirmationEnvelope: parsed.envelope });

if (saved.error) {
  respondJson({
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: "OUTER v3 could not persist the rendered confirmation. Mutation remains fail-closed. Explain the state-storage failure and continue read-only."
    }
  });
  process.exit(0);
}

respondJson();
