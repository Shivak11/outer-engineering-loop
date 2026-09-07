#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const OUTER_SCHEMA_VERSION = 3;
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
export const ACTION_CLASSES = new Set([
  "edit-files",
  "delete-files",
  "run-tests",
  "build",
  "commit",
  "push",
  "open-pr",
  "merge",
  "deploy",
  "install",
  "external-write",
  "delegate-write",
  "interactive-write",
  "shell-write"
]);

const ENVIRONMENTS = new Set(["none", "local", "test", "development", "staging", "production"]);
const hash = (value) => crypto.createHash("sha256").update(String(value ?? "")).digest("hex");
const APPROVAL_PHRASE = /^APPROVE OUTER-[A-Z0-9]{6,16}$/;

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const readGitDir = (repoRoot) => {
  const marker = path.join(repoRoot, ".git");
  try {
    const stat = fs.statSync(marker);
    if (stat.isDirectory()) return marker;
    const pointer = fs.readFileSync(marker, "utf8").trim();
    const match = /^gitdir:\s*(.+)$/i.exec(pointer);
    return match ? path.resolve(repoRoot, match[1]) : "";
  } catch {
    return "";
  }
};

const findRepository = (cwd) => {
  let current = path.resolve(cwd || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(cwd || process.cwd());
    current = parent;
  }
};

const readBranch = (repoRoot) => {
  const gitDir = readGitDir(repoRoot);
  if (!gitDir) return "unknown";
  try {
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    const match = /^ref:\s+refs\/heads\/(.+)$/.exec(head);
    return match ? match[1] : "detached:" + head.slice(0, 12);
  } catch {
    return "unknown";
  }
};

export const nowMs = () => {
  const override = Number(process.env.OUTER_NOW_MS);
  return Number.isFinite(override) ? override : Date.now();
};

export const createApprovalPhrase = () => {
  const supplied = String(process.env.OUTER_APPROVAL_NONCE || "").trim().toUpperCase();
  const nonce = /^[A-Z0-9]{6,16}$/.test(supplied)
    ? supplied
    : crypto.randomBytes(4).toString("hex").toUpperCase();
  return `APPROVE OUTER-${nonce}`;
};

export const approvalPhraseFromPrompt = (prompt) => {
  const candidate = String(prompt || "").trim();
  return APPROVAL_PHRASE.test(candidate) ? candidate : "";
};

export const approvalPhraseHash = (phrase) => hash(`outer-approval:${String(phrase || "").trim()}`);

export const ttlMs = () => {
  const override = Number(process.env.OUTER_STATE_TTL_MS);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_TTL_MS;
};

export const readJsonInput = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const respondJson = (value = {}) => process.stdout.write(JSON.stringify(value));
export const hookEventName = (input) => firstString(input?.hook_event_name, input?.event_name, input?.hookEventName);
export const promptFromInput = (input) => firstString(
  input?.prompt,
  input?.user_prompt,
  input?.userPrompt,
  typeof input?.message === "string" ? input.message : "",
  input?.message?.text
);
export const assistantMessageFromInput = (input) => firstString(
  input?.last_assistant_message,
  input?.lastAssistantMessage
);
export const assistantTurnFromInput = (input) => firstString(
  input?.turn_id,
  input?.turnId,
  input?.prompt_id,
  input?.promptId
);
export const toolNameFromInput = (input) => firstString(input?.tool_name, input?.toolName, input?.tool, input?.name);
export const toolInputFromInput = (input) => {
  for (const value of [input?.tool_input, input?.arguments, input?.input, input?.args]) {
    if (value && typeof value === "object") return value;
  }
  return {};
};

export const resolveScope = (input = {}) => {
  const cwd = firstString(input.cwd, input.working_directory, input.project_dir, process.cwd());
  const repoRoot = findRepository(cwd);
  const client = firstString(process.env.OUTER_CLIENT, input.client, input.client_name, input.clientName, "unknown-client").toLowerCase();
  const session = firstString(
    process.env.OUTER_SESSION_ID,
    input.session_id,
    input.sessionId,
    input.transcript_path,
    input.transcriptPath
  );
  const branch = firstString(
    process.env.OUTER_BRANCH,
    input.branch,
    input.git_branch,
    input.gitBranch,
    readBranch(repoRoot)
  );
  let userIdentity = "unknown-user";
  try {
    const info = os.userInfo();
    userIdentity = String(info.uid) + ":" + info.username;
  } catch {
    userIdentity = String(process.getuid?.() ?? "unknown-user");
  }
  const hashes = {
    clientHash: hash(client),
    userHash: hash(userIdentity),
    sessionHash: hash(session || "missing-session-identity"),
    repositoryHash: hash(repoRoot),
    branchHash: hash(branch)
  };
  return {
    ...hashes,
    key: hash(Object.values(hashes).join(":")),
    sessionKnown: Boolean(session),
    repoRoot,
    branch
  };
};

export const stateFileFor = (input = {}) => {
  const scope = resolveScope(input);
  const root = process.env.OUTER_HOOK_STATE_DIR || path.join(os.tmpdir(), "outer-v3");
  return { scope, root, file: path.join(root, scope.key + ".json") };
};

export const readState = (input = {}) => {
  const location = stateFileFor(input);
  if (!location.scope.sessionKnown) {
    const error = new Error("OUTER requires a client session identifier to isolate confirmation state");
    error.code = "EOUTERSESSION";
    return { ...location, record: null, expired: false, error };
  }
  try {
    const record = JSON.parse(fs.readFileSync(location.file, "utf8"));
    if (!record || record.schemaVersion !== OUTER_SCHEMA_VERSION) {
      return { ...location, record: null, expired: false, error: null };
    }
    if (Number(record.expiresAt || 0) <= nowMs()) {
      return { ...location, record: null, expired: true, error: null };
    }
    return { ...location, record, expired: false, error: null };
  } catch (error) {
    if (error?.code === "ENOENT") return { ...location, record: null, expired: false, error: null };
    return { ...location, record: null, expired: false, error };
  }
};

const cleanStringArray = (values) => [...new Set(
  (Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value)
)].sort();

const sanitizeEnvelope = (envelope) => {
  if (!envelope || typeof envelope !== "object") return null;
  return {
    envelopeHash: typeof envelope.envelopeHash === "string" ? envelope.envelopeHash : "",
    approvalPhraseHash: typeof envelope.approvalPhraseHash === "string" ? envelope.approvalPhraseHash : "",
    assistantTurnHash: typeof envelope.assistantTurnHash === "string" ? envelope.assistantTurnHash : "",
    objectiveHash: typeof envelope.objectiveHash === "string" ? envelope.objectiveHash : "",
    allowedActions: cleanStringArray(envelope.allowedActions).filter((value) => ACTION_CLASSES.has(value)),
    allowedPathRuleHashes: cleanStringArray(envelope.allowedPathRuleHashes),
    allowedDestinationHashes: cleanStringArray(envelope.allowedDestinationHashes),
    environment: ENVIRONMENTS.has(envelope.environment) ? envelope.environment : "none",
    exclusionsHash: typeof envelope.exclusionsHash === "string" ? envelope.exclusionsHash : "",
    boundaryHash: typeof envelope.boundaryHash === "string" ? envelope.boundaryHash : "",
    blastRadiusHash: typeof envelope.blastRadiusHash === "string" ? envelope.blastRadiusHash : "",
    benchmarkHash: typeof envelope.benchmarkHash === "string" ? envelope.benchmarkHash : "",
    evidenceHash: typeof envelope.evidenceHash === "string" ? envelope.evidenceHash : "",
    recoveryHash: typeof envelope.recoveryHash === "string" ? envelope.recoveryHash : ""
  };
};

export const writeState = (input, value) => {
  const location = stateFileFor(input);
  if (!location.scope.sessionKnown) {
    const error = new Error("OUTER requires a client session identifier to isolate confirmation state");
    error.code = "EOUTERSESSION";
    return { record: null, error };
  }
  const timestamp = nowMs();
  const record = {
    schemaVersion: OUTER_SCHEMA_VERSION,
    lifecycle: value.lifecycle,
    clientHash: location.scope.clientHash,
    userHash: location.scope.userHash,
    sessionHash: location.scope.sessionHash,
    repositoryHash: location.scope.repositoryHash,
    branchHash: location.scope.branchHash,
    taskHash: value.taskHash || "",
    riskHash: hash(JSON.stringify(value.scopeMeta || {})),
    scopeMeta: value.scopeMeta || emptyScopeMeta(),
    confirmationEnvelope: sanitizeEnvelope(value.confirmationEnvelope),
    pendingConfirmationEnvelope: sanitizeEnvelope(value.pendingConfirmationEnvelope),
    bypassEnvelope: sanitizeEnvelope(value.bypassEnvelope),
    pendingApprovalPhraseHash: typeof value.pendingApprovalPhraseHash === "string" ? value.pendingApprovalPhraseHash : "",
    bypassRiskHash: value.bypassRiskHash || "",
    createdAt: Number(value?.createdAt || timestamp),
    updatedAt: timestamp,
    expiresAt: timestamp + ttlMs()
  };
  try {
    fs.mkdirSync(location.root, { recursive: true, mode: 0o700 });
    const tempFile = location.file + "." + process.pid + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(record) + "\n", { mode: 0o600 });
    fs.renameSync(tempFile, location.file);
    return { record, error: null };
  } catch (error) {
    return { record: null, error };
  }
};

export const emptyScopeMeta = () => ({ actions: [], systems: [], environments: [], consequences: [] });
const addIf = (target, label, expression, text) => expression.test(text) && target.add(label);

export const scopeMetaFromText = (text) => {
  const normalized = String(text || "").toLowerCase();
  const actions = new Set();
  const systems = new Set();
  const environments = new Set();
  const consequences = new Set();
  addIf(actions, "write", /\b(implement|add|change|update|fix|refactor|rewrite|migrate|integrate|redesign|replace|upgrade|install|configure|automate|set\s*up|create|make|remove|delete|flush|go ahead|try again)\b|\bbuild(?:\s+(?:a|an|the))?(?:\s+[a-z0-9_-]+){0,3}\s+(?:app|application|api|feature|service|website|screen|component|backend|frontend|mobile app|integration)\b/, normalized);
  addIf(actions, "commit", /\bcommit(?:ted|ting)?\b/, normalized);
  addIf(actions, "push", /\bpush(?:ed|ing)?\b/, normalized);
  addIf(actions, "merge", /\bmerge(?:d|ing)?\b/, normalized);
  addIf(actions, "pull-request", /\b(?:pull request|pr)\b|\braise\s+(?:a\s+)?pr\b/, normalized);
  addIf(actions, "build", /\b(?:run|create|make|start|rebuild|device|staging|production)\b.{0,24}\bbuild\b|\bbuild\s+(?:now|again|on|for|the\s+(?:app|device))\b/, normalized);
  addIf(actions, "deploy", /\bdeploy(?:ed|ment|ing)?\b/, normalized);
  addIf(actions, "release", /\brelease(?:d|ing)?\b|\bship(?:ped|ping)?\b/, normalized);
  addIf(actions, "delete", /\b(delete|remove|flush|wipe|purge)\b/, normalized);
  addIf(actions, "install", /\binstall(?:ed|ing)?\b/, normalized);
  addIf(systems, "code", /\b(code|codebase|repo|repository|feature|bug|hook|skill|agent|script|test|app|application)\b/, normalized);
  addIf(systems, "backend", /\b(backend|server|service|worker|queue|job|pipeline)\b/, normalized);
  addIf(systems, "frontend", /\b(frontend|ui|ux|website|screen|component)\b/, normalized);
  addIf(systems, "mobile", /\b(mobile|ios|android|iphone|device)\b/, normalized);
  addIf(systems, "api", /\b(api|endpoint|route|sdk)\b/, normalized);
  addIf(systems, "database", /\b(database|schema|redis|postgres|migration|cache)\b/, normalized);
  addIf(systems, "authentication", /\b(auth|authentication|authorization|account recovery|sign[ -]?in|login)\b/, normalized);
  addIf(systems, "payment", /\b(payment|billing|money|stripe)\b/, normalized);
  addIf(systems, "configuration", /\b(config|configuration|hook|environment variable|secret|credential)\b/, normalized);
  if (systems.has("api") || systems.has("database")) systems.add("backend");
  addIf(environments, "production", /\b(prod|production|release)\b/, normalized);
  addIf(environments, "staging", /\bstaging\b/, normalized);
  addIf(environments, "development", /\b(dev|development)\b/, normalized);
  addIf(environments, "local", /\b(local|simulator|localhost)\b/, normalized);
  addIf(consequences, "destructive", /\b(delete|remove|flush|wipe|purge|reset|overwrite)\b/, normalized);
  addIf(consequences, "security", /\b(auth|authentication|authorization|permission|credential|secret|security|account recovery)\b/, normalized);
  addIf(consequences, "privacy", /\b(personal data|private data|user data|pii)\b/, normalized);
  addIf(consequences, "cost", /\b(cost|billing|payment|paid api)\b/, normalized);
  addIf(consequences, "external-state", /\b(push|merge|pull request|deploy|release|ship|send|publish)\b/, normalized);
  if (actions.has("write")) systems.add("code");
  return {
    actions: [...actions].sort(),
    systems: [...systems].sort(),
    environments: [...environments].sort(),
    consequences: [...consequences].sort()
  };
};

export const mergeScopeMeta = (...values) => {
  const merged = emptyScopeMeta();
  for (const key of Object.keys(merged)) {
    merged[key] = [...new Set(values.flatMap((value) => value?.[key] || []))].sort();
  }
  return merged;
};
export const scopeExpansion = (approved, requested) => {
  const additions = emptyScopeMeta();
  for (const key of Object.keys(additions)) {
    const accepted = new Set(approved?.[key] || []);
    additions[key] = (requested?.[key] || []).filter((value) => !accepted.has(value));
  }
  return additions;
};
export const hasExpansion = (expansion) => Object.values(expansion || {}).some((values) => Array.isArray(values) && values.length > 0);
export const compactExpansion = (expansion) => Object.values(expansion || {}).flat().join(", ");

const canonicalPath = (raw, repoRoot) => {
  const stripped = String(raw || "").trim().replace(/^\x60|\x60$/g, "").replace(/^['"]|['"]$/g, "");
  const prefix = stripped.endsWith("/**");
  const base = prefix ? stripped.slice(0, -3) : stripped;
  if (!base || base === "*") return null;
  const absolute = path.isAbsolute(base) ? path.normalize(base) : path.resolve(repoRoot, base);
  const relative = path.relative(repoRoot, absolute);
  const inside = relative === "" || (!relative.startsWith(".." + path.sep) && relative !== "..");
  const value = inside ? (relative || ".").split(path.sep).join("/") : "absolute:" + absolute;
  return { kind: prefix ? "prefix" : "exact", value };
};

export const pathRuleHash = (raw, repoRoot) => {
  const rule = canonicalPath(raw, repoRoot);
  return rule ? hash(rule.kind + ":" + rule.value) : "";
};

export const pathTargetHashes = (raw, repoRoot) => {
  const rule = canonicalPath(raw, repoRoot);
  if (!rule) return [];
  const hashes = [hash("exact:" + rule.value)];
  if (!rule.value.startsWith("absolute:")) {
    const parts = rule.value === "." ? [] : rule.value.split("/");
    for (let index = parts.length - 1; index >= 1; index -= 1) {
      hashes.push(hash("prefix:" + parts.slice(0, index).join("/")));
    }
    hashes.push(hash("prefix:."));
  } else {
    const absolute = rule.value.slice("absolute:".length);
    const segments = absolute.split(path.sep).filter(Boolean);
    for (let index = segments.length - 1; index >= 1; index -= 1) {
      hashes.push(hash("prefix:absolute:" + path.sep + segments.slice(0, index).join(path.sep)));
    }
  }
  return hashes;
};

const canonicalDestination = (raw) => String(raw || "")
  .trim()
  .replace(/^\x60|\x60$/g, "")
  .replace(/^['"]|['"]$/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ");

export const destinationHash = (raw) => {
  const destination = canonicalDestination(raw);
  return destination && destination !== "none" ? hash(`destination:${destination}`) : "";
};

export const explicitPathsFromText = (text) => {
  const source = String(text || "");
  const candidates = new Set();
  for (const match of source.matchAll(/`([^`]+)`/g)) candidates.add(match[1]);
  for (const match of source.matchAll(/(?:^|\s)((?:\.{0,2}\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+(?:\/\*\*)?|[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]{1,12})(?=$|[\s,.;:)\]])/g)) {
    if (!/^https?:\/\//i.test(match[1])) candidates.add(match[1]);
  }
  return [...candidates].map((value) => value.trim()).filter(Boolean);
};

const actionClassesFromScope = (scopeMeta) => {
  const mapped = new Set();
  for (const action of scopeMeta?.actions || []) {
    if (action === "write") mapped.add("edit-files");
    else if (action === "delete") mapped.add("delete-files");
    else if (action === "pull-request") mapped.add("open-pr");
    else if (action === "release") mapped.add("deploy");
    else if (ACTION_CLASSES.has(action)) mapped.add(action);
  }
  return [...mapped].sort();
};

export const bypassEnvelopeFromPrompt = (input, prompt, scopeMeta) => {
  const scope = resolveScope(input);
  const allowedActions = actionClassesFromScope(scopeMeta);
  const paths = explicitPathsFromText(prompt);
  const pathRules = paths.map((value) => pathRuleHash(value, scope.repoRoot)).filter(Boolean);
  const payload = {
    assistantTurnHash: hash(`skip:${promptHash(prompt)}`),
    approvalPhraseHash: "",
    objectiveHash: promptHash(prompt),
    allowedActions,
    allowedPathRuleHashes: cleanStringArray(pathRules),
    allowedDestinationHashes: [],
    environment: (scopeMeta?.environments || []).length === 1 ? scopeMeta.environments[0] : "none",
    exclusionsHash: hash("all-other-mutations"),
    boundaryHash: hash("task-scoped-skip"),
    blastRadiusHash: hash(JSON.stringify(scopeMeta || {})),
    benchmarkHash: "",
    evidenceHash: "",
    recoveryHash: ""
  };
  return { ...payload, envelopeHash: hash(JSON.stringify(payload)) };
};

const fieldFromMessage = (message, label) => {
  const wanted = label.toLowerCase();
  for (const rawLine of String(message || "").split(/\r?\n/)) {
    const line = rawLine.replace(/\*\*/g, "").trim().replace(/^[-*]\s+/, "");
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    if (line.slice(0, separator).trim().toLowerCase() === wanted) return line.slice(separator + 1).trim();
  }
  return "";
};

const commaList = (value) => String(value || "").split(",").map((item) => item.trim().replace(/^\x60|\x60$/g, "")).filter(Boolean);

export const confirmationEnvelopeFromMessage = (input, message, expectedApprovalPhraseHash = "") => {
  const text = String(message || "");
  const scope = resolveScope(input);
  const assistantTurn = assistantTurnFromInput(input);
  const looksLikeConfirmation = /OUTER action confirmation/i.test(text) || /Reply exactly:\s*APPROVE OUTER-/i.test(text);
  if (!looksLikeConfirmation) return { envelope: null, error: null };
  if (!scope.sessionKnown) return { envelope: null, error: "OUTER cannot arm confirmation without a session identifier." };
  if (!assistantTurn) return { envelope: null, error: "OUTER cannot bind confirmation because this host did not provide a turn identifier." };
  if (!/OUTER action confirmation/i.test(text)) {
    return { envelope: null, error: "The OUTER confirmation heading is required." };
  }

  const fields = {
    change: fieldFromMessage(text, "Change"),
    repository: fieldFromMessage(text, "Repository"),
    branch: fieldFromMessage(text, "Branch"),
    environment: fieldFromMessage(text, "Environment").toLowerCase(),
    allowedMutations: fieldFromMessage(text, "Allowed mutations"),
    allowedPaths: fieldFromMessage(text, "Allowed paths"),
    allowedDestinations: fieldFromMessage(text, "Allowed destinations"),
    excludedMutations: fieldFromMessage(text, "Excluded mutations"),
    boundary: fieldFromMessage(text, "Boundary"),
    blastRadius: fieldFromMessage(text, "Blast radius"),
    benchmark: fieldFromMessage(text, "Benchmark basis"),
    verification: fieldFromMessage(text, "Verification"),
    recovery: fieldFromMessage(text, "Recovery"),
    approvalPhrase: fieldFromMessage(text, "Approval phrase")
  };
  const missing = Object.entries(fields).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) return { envelope: null, error: "OUTER confirmation is missing: " + missing.join(", ") + "." };

  const repositoryName = path.basename(scope.repoRoot).toLowerCase();
  if (!fields.repository.toLowerCase().includes(repositoryName)) {
    return { envelope: null, error: "OUTER confirmation repository must name the current worktree " + path.basename(scope.repoRoot) + "." };
  }
  if (fields.branch.replace(/\x60/g, "") !== scope.branch) {
    return { envelope: null, error: "OUTER confirmation branch must exactly match " + scope.branch + "." };
  }
  if (!ENVIRONMENTS.has(fields.environment)) {
    return { envelope: null, error: "OUTER confirmation environment must be none, local, test, development, staging, or production." };
  }

  const allowedActions = commaList(fields.allowedMutations);
  const unsupported = allowedActions.filter((value) => !ACTION_CLASSES.has(value));
  if (!allowedActions.length || unsupported.length) {
    return { envelope: null, error: "OUTER confirmation uses unsupported allowed mutations: " + (unsupported.join(", ") || "none supplied") + "." };
  }
  const pathValues = commaList(fields.allowedPaths);
  const noPaths = pathValues.length === 1 && /^none(?:\s|$)/i.test(pathValues[0]);
  const pathRules = noPaths ? [] : pathValues.map((value) => pathRuleHash(value, scope.repoRoot));
  if (!noPaths && (pathRules.length === 0 || pathRules.some((value) => !value))) {
    return { envelope: null, error: "OUTER confirmation allowed paths must use exact paths or a directory ending in /**." };
  }
  if (["edit-files", "delete-files", "run-tests", "build", "install", "shell-write"].some((value) => allowedActions.includes(value)) && noPaths) {
    return { envelope: null, error: "Filesystem mutations require at least one exact allowed path." };
  }
  const destinationValues = commaList(fields.allowedDestinations);
  const noDestinations = destinationValues.length === 1 && /^none(?:\s|$)/i.test(destinationValues[0]);
  const destinationBoundActions = ["push", "open-pr", "merge", "deploy", "external-write"];
  if (destinationBoundActions.some((value) => allowedActions.includes(value)) && noDestinations) {
    return { envelope: null, error: "External mutations require at least one exact allowed destination." };
  }
  const destinationHashes = noDestinations ? [] : destinationValues.map(destinationHash);
  if (!noDestinations && (destinationHashes.length === 0 || destinationHashes.some((value) => !value))) {
    return { envelope: null, error: "OUTER confirmation allowed destinations must name exact canonical destinations." };
  }
  if (!commaList(fields.excludedMutations).includes("all-other-mutations")) {
    return { envelope: null, error: "OUTER confirmation must explicitly exclude all-other-mutations." };
  }

  if (!APPROVAL_PHRASE.test(fields.approvalPhrase)) {
    return { envelope: null, error: "OUTER confirmation must contain the generated task-specific approval phrase." };
  }
  const phraseHash = approvalPhraseHash(fields.approvalPhrase);
  if (!expectedApprovalPhraseHash || phraseHash !== expectedApprovalPhraseHash) {
    return { envelope: null, error: "OUTER confirmation approval phrase is stale or does not match this task." };
  }
  const lastLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\*\*/g, "").replace(/\x60/g, "").trim())
    .filter(Boolean)
    .at(-1);
  if (lastLine !== `Reply exactly: ${fields.approvalPhrase}`) {
    return { envelope: null, error: "OUTER confirmation must end with the exact task-specific reply instruction." };
  }

  const payload = {
    assistantTurnHash: hash(assistantTurn),
    approvalPhraseHash: phraseHash,
    objectiveHash: hash(fields.change),
    allowedActions: cleanStringArray(allowedActions),
    allowedPathRuleHashes: cleanStringArray(pathRules),
    allowedDestinationHashes: cleanStringArray(destinationHashes),
    environment: fields.environment,
    exclusionsHash: hash(fields.excludedMutations),
    boundaryHash: hash(fields.boundary),
    blastRadiusHash: hash(fields.blastRadius),
    benchmarkHash: hash(fields.benchmark),
    evidenceHash: hash(fields.verification),
    recoveryHash: hash(fields.recovery)
  };
  return { envelope: { ...payload, envelopeHash: hash(JSON.stringify(payload)) }, error: null };
};

export const envelopeAllows = (
  envelope,
  requestedActions,
  requestedPaths,
  requestedDestinations,
  requestedEnvironments,
  repoRoot
) => {
  if (!envelope?.envelopeHash || !envelope?.assistantTurnHash) return false;
  if ((requestedActions || []).some((action) => !envelope.allowedActions?.includes(action))) return false;
  const allowed = new Set(envelope.allowedPathRuleHashes || []);
  if (!(requestedPaths || []).every((target) => pathTargetHashes(target, repoRoot).some((candidate) => allowed.has(candidate)))) {
    return false;
  }
  const destinationBoundActions = new Set(["push", "open-pr", "merge", "deploy", "external-write"]);
  if ((requestedActions || []).some((action) => destinationBoundActions.has(action)) && !(requestedDestinations || []).length) {
    return false;
  }
  const allowedDestinations = new Set(envelope.allowedDestinationHashes || []);
  if (!(requestedDestinations || []).every((target) => allowedDestinations.has(destinationHash(target)))) {
    return false;
  }
  return (requestedEnvironments || []).every((environment) => envelope.environment === environment);
};

export const promptHash = (prompt) => hash(String(prompt || "").trim().toLowerCase().replace(/\s+/g, " "));
export const privacyHash = hash;
