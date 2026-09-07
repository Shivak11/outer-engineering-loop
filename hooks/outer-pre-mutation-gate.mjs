#!/usr/bin/env node

// OUTER v3 pre-mutation gate.
//
// The gate arms only for code changes and their delivery: code-file writes,
// git state changes, installs, builds, deploys, and destructive external
// calls. Reads, docs, mocks, scratch and temp writes, tool or skill loads,
// and analysis shell commands pass through ungated.
//
// While an approval is CONFIRMED or ACTIVE, a call outside the approved
// envelope does not destroy that approval. It blocks the single call and arms
// an expansion challenge beside the intact envelope.

import {
  approvalPhraseHash,
  compactExpansion,
  createApprovalPhrase,
  emptyScopeMeta,
  envelopeAllows,
  hasExpansion,
  hookEventName,
  mergeScopeMeta,
  readJsonInput,
  readState,
  resolveScope,
  respondJson,
  scopeExpansion,
  scopeMetaFromText,
  toolInputFromInput,
  toolNameFromInput,
  writeState
} from "./outer-state.mjs";

const input = await readJsonInput();
const event = hookEventName(input);

if (event && event !== "PreToolUse") {
  respondJson();
  process.exit(0);
}

const toolName = toolNameFromInput(input);
const toolInput = toolInputFromInput(input);

const commandFrom = (value) => {
  for (const candidate of [value?.command, value?.cmd, value?.script, value?.source, value?.code]) {
    if (typeof candidate === "string") return candidate;
  }
  return "";
};

const patchPaths = (value) => {
  const source = [value?.patch, value?.input, value?.source, value?.code]
    .find((candidate) => typeof candidate === "string") || "";
  return [...source.matchAll(/^\*\*\*\s+(?:Add|Update|Delete) File:\s+(.+)$/gm)]
    .map((match) => match[1].trim());
};

const shellWords = (source) => [...String(source || "").matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s]+/g)]
  .map((match) => match[0].replace(/^['"]|['"]$/g, ""));

const optionValue = (words, name) => {
  const exact = words.indexOf(name);
  if (exact >= 0) return words[exact + 1] || "";
  const prefix = words.find((word) => word.startsWith(`${name}=`));
  if (prefix) return prefix.slice(name.length + 1);
  const attached = /^-[A-Za-z]$/.test(name)
    ? words.find((word) => word.startsWith(name) && word.length > name.length)
    : "";
  return attached ? attached.slice(name.length) : "";
};

const externalTargetPairs = (value) => {
  const pairs = [];
  const keys = [
    "repo", "repository", "remote", "ref", "branch", "base", "head",
    "environment", "channel", "channel_id", "conversation_id", "recipient",
    "to", "service", "project", "deployment", "target", "url", "uri",
    "account", "customer", "payment_intent", "resource_id", "id", "name"
  ];
  for (const key of keys) {
    const candidate = value?.[key] ?? value?.arguments?.[key];
    if (["string", "number"].includes(typeof candidate) && String(candidate).trim()) {
      pairs.push(`${key}=${String(candidate).trim().toLowerCase()}`);
    }
  }
  return [...new Set(pairs)].sort();
};

const externalDescriptor = (name, value) => {
  const normalizedName = String(name || "external-operation").toLowerCase();
  const pairs = externalTargetPairs(value);
  const targetRequired = /send|post|message|publish|push|merge|deploy|release|delete|remove|refund|charge|transfer|invite|permission|share|email|slack|save|write|update|create/i.test(normalizedName);
  if (targetRequired && pairs.length === 0) return "";
  return `tool:${normalizedName}${pairs.length ? `|${pairs.join("&")}` : ""}`;
};

const nestedToolCalls = (source) => {
  const calls = [];
  const aliases = new Map();
  const text = String(source || "");
  const member = String.raw`tools(?:\.([A-Za-z0-9_$]+)|\[\s*["']([A-Za-z0-9_$]+)["']\s*\])`;
  const aliasPattern = new RegExp(String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*${member}`, "g");
  for (const match of text.matchAll(aliasPattern)) {
    aliases.set(match[1], match[2] || match[3]);
  }
  const destructuredNames = new Set();
  for (const match of text.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*tools\b/g)) {
    for (const entry of match[1].split(",")) {
      const binding = /^\s*([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?\s*$/.exec(entry);
      if (!binding) continue;
      const name = binding[1];
      const alias = binding[2] || name;
      destructuredNames.add(name);
      aliases.set(alias, name);
    }
  }
  const patterns = [
    new RegExp(String.raw`\b${member}\s*\(\s*\{([\s\S]*?)\}\s*\)`, "g"),
    ...[...aliases].map(([alias, name]) => ({
      alias,
      name,
      pattern: new RegExp(String.raw`\b${alias}\s*\(\s*\{([\s\S]*?)\}\s*\)`, "g")
    }))
  ];
  const append = (name, body) => {
    const value = {};
    for (const key of [
      "repo", "repository", "remote", "ref", "branch", "base", "head",
      "environment", "channel", "channel_id", "conversation_id", "recipient",
      "to", "service", "project", "deployment", "target", "url", "uri",
      "account", "customer", "payment_intent", "resource_id", "id", "name"
    ]) {
      const field = new RegExp(`\\b${key}\\s*:\\s*["']([^"']+)["']`, "i").exec(body);
      if (field) value[key] = field[1];
    }
    calls.push({ name, value });
  };
  for (const pattern of patterns) {
    if (pattern instanceof RegExp) {
      for (const match of text.matchAll(pattern)) append(match[1] || match[2], match[3] || "");
    } else {
      for (const match of text.matchAll(pattern.pattern)) append(pattern.name, match[1] || "");
    }
  }
  const referenced = new RegExp(String.raw`\b${member}`, "g");
  for (const match of text.matchAll(referenced)) {
    const name = match[1] || match[2];
    if (!calls.some((call) => call.name === name)) calls.push({ name, value: {} });
  }
  for (const name of destructuredNames) {
    if (!calls.some((call) => call.name === name)) calls.push({ name, value: {} });
  }
  return calls;
};

const gitSubcommandPattern = (subcommand, flags = "gi") => new RegExp(
  String.raw`\bgit(?:\s+-c\s+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s;&|]+))*\s+${subcommand}\b([^;&|]*)`,
  flags
);

const githubApiMutation = (command, scope) => {
  const actions = new Set();
  const destinations = new Set();
  for (const match of String(command || "").matchAll(/\bgh\s+api\b([^;&|]*)/gi)) {
    const segment = match[1];
    const words = shellWords(segment);
    const explicitMethod = optionValue(words, "--method") || optionValue(words, "-X");
    const implicitPost = /(?:^|\s)(?:-f|-F|--field|--raw-field|--input)(?:=|\s)/i.test(segment);
    const method = (explicitMethod || (implicitPost ? "POST" : "GET")).toUpperCase();
    if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method)) continue;
    const pullCreate = /\brepos\/([^\s/]+\/[^\s/]+)\/pulls(?:\s|$)/i.exec(segment);
    if (method === "POST" && pullCreate) {
      actions.add("open-pr");
      const base = /(?:^|\s)(?:-f|-F|--field|--raw-field)\s+["']?base=([^\s"']+)/i.exec(segment)?.[1];
      const head = /(?:^|\s)(?:-f|-F|--field|--raw-field)\s+["']?head=([^\s"']+)/i.exec(segment)?.[1] || scope.branch;
      if (base && head) destinations.add(`github-pr-create:${pullCreate[1].toLowerCase()}:${base}:${head}`);
    } else {
      actions.add("external-write");
    }
  }
  return { actions: [...actions], destinations: [...destinations] };
};

const commandDestinations = (command, scope) => {
  const destinations = new Set();
  for (const match of String(command || "").matchAll(gitSubcommandPattern("push"))) {
    const words = shellWords(match[1]).filter((word) => !word.startsWith("-"));
    if (words.length >= 2) destinations.add(`git-push:${words[0]}:${words[1]}`);
  }
  for (const match of String(command || "").matchAll(/\bgit\s+merge\b([^;&|]*)/gi)) {
    const words = shellWords(match[1]).filter((word) => !word.startsWith("-"));
    if (words.length >= 1) destinations.add(`git-merge:${words[0]}`);
  }
  for (const match of String(command || "").matchAll(/\bgh\s+pr\s+(create|edit|close|reopen|merge)\b([^;&|]*)/gi)) {
    const operation = match[1].toLowerCase();
    const words = shellWords(match[2]);
    const repo = optionValue(words, "--repo") || "current-repo";
    if (operation === "create") {
      const base = optionValue(words, "--base");
      const head = optionValue(words, "--head") || scope.branch;
      if (base && head) destinations.add(`github-pr-create:${repo}:${base}:${head}`);
    } else {
      const number = words.find((word) => /^\d+$/.test(word));
      if (number) destinations.add(`github-pr-${operation}:${repo}:${number}`);
    }
  }
  for (const match of String(command || "").matchAll(/\bgh\s+run\s+(rerun|cancel)\b([^;&|]*)/gi)) {
    const operation = match[1].toLowerCase();
    const words = shellWords(match[2]);
    const repo = (optionValue(words, "--repo") || optionValue(words, "-R") || "current-repo").toLowerCase();
    const runId = words.find((word) => /^\d+$/.test(word)) || "latest";
    destinations.add(`github-run-${operation}:${repo}:${runId}`);
  }
  for (const match of String(command || "").matchAll(/\bgh\s+workflow\s+(run|enable|disable)\b([^;&|]*)/gi)) {
    const operation = match[1].toLowerCase();
    const words = shellWords(match[2]);
    const repo = (optionValue(words, "--repo") || optionValue(words, "-R") || "current-repo").toLowerCase();
    const workflow = words.find((word) => !word.startsWith("-")) || "unspecified";
    destinations.add(`github-workflow-${operation}:${repo}:${workflow.toLowerCase()}`);
  }
  for (const match of String(command || "").matchAll(/\bvercel\s+deploy\b([^;&|]*)/gi)) {
    const words = shellWords(match[1]);
    const target = words.includes("--prod") || optionValue(words, "--target") === "production"
      ? "production"
      : (optionValue(words, "--target") || "preview");
    destinations.add(`deploy:vercel:${target}`);
  }
  for (const match of String(command || "").matchAll(/\brender\s+deploy\b([^;&|]*)/gi)) {
    const words = shellWords(match[1]).filter((word) => !word.startsWith("-"));
    if (words[0]) destinations.add(`deploy:render:${words[0]}`);
  }
  githubApiMutation(command, scope).destinations.forEach((destination) => destinations.add(destination));
  return [...destinations].sort();
};

// --- Code-fix classification (2026-08-04 amendment) ---

const EXEMPT_PATH_RX = /^\/tmp\/|^\/private\/tmp\/|\/scratchpad(?:\/|$)|\/\.claude\/projects\/|\/\.Trash\/|(?:^|\/)(?:node_modules|\.engineering|mockups|journey-contracts|design-system|coverage|\.expo|DerivedData)(?:\/|$)/i;

const CODE_FILE_RX = /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|kt|kts|swift|mm?|h|hpp|cc?|cpp|sh|bash|zsh|fish|ps1|sql|graphql|gql|proto|gradle|podspec|plist|toml|ya?ml)$/i;

const CODE_CONFIG_RX = /(?:^|\/)(?:package(?:-lock)?\.json|app\.json|eas\.json|tsconfig[^\/]*\.json|babel\.config\.[^\/]+|metro\.config\.[^\/]+|jest\.config\.[^\/]+|Podfile(?:\.lock)?|Gemfile(?:\.lock)?|Makefile|Dockerfile|yarn\.lock|pnpm-lock\.yaml|Cargo\.(?:toml|lock)|pyproject\.toml|requirements[^\/]*\.txt)$/i;

const isCodeMutationPath = (raw) => {
  const value = String(raw || "").trim().replace(/^['"]|['"]$/g, "");
  if (!value) return false;
  if (EXEMPT_PATH_RX.test(value)) return false;
  return CODE_FILE_RX.test(value) || CODE_CONFIG_RX.test(value);
};

const SAFE_DELETE_RX = /^(?:\/private)?\/tmp\/|\/scratchpad(?:\/|$)|\/\.Trash\/|(?:^|\/)(?:node_modules|\.expo|coverage|DerivedData|dist|build)(?:\/|$)/i;

const redirectTargets = (command) => {
  const targets = [];
  for (const match of String(command || "").matchAll(/\d*>{1,2}\s*([^\s;|&<>]+)/g)) {
    targets.push(match[1]);
  }
  for (const match of String(command || "").matchAll(/\btee\b\s+(?:-a\s+)?([^\s;|&]+)/g)) {
    targets.push(match[1]);
  }
  return targets.filter((target) => !/^&|^\/dev\//.test(target));
};

const deletionTargets = (command) => {
  const targets = [];
  for (const match of String(command || "").matchAll(/(?:^|[;|&]\s*|\s)(?:rm|rmdir|unlink)\s([^;|&]*)/g)) {
    for (const word of shellWords(match[1])) {
      if (!word.startsWith("-")) targets.push(word);
    }
  }
  return targets;
};

const shellMutationProfile = (command, scope) => {
  const text = String(command || "");
  const actions = new Set();
  const paths = new Set();
  const destinations = new Set();
  const git = (subcommand) => gitSubcommandPattern(subcommand, "i").test(text);

  if (git("commit")) actions.add("commit");
  if (git("push")) actions.add("push");
  if (git("merge") || /\bgh\s+pr\s+merge\b/i.test(text)) actions.add("merge");
  if (/\bgh\s+pr\s+(?:create|edit|close|reopen|ready)\b/i.test(text)) actions.add("open-pr");
  if (["rebase", "cherry-pick", "revert", "reset", "checkout", "switch", "restore", "stash", "clean", "am", "apply", "mv", "rm"].some(git)) {
    actions.add("shell-write");
  }
  if (/\bgit\s+branch\s+(?:-[dDmM]\b|--delete\b|--move\b)/i.test(text)) actions.add("shell-write");
  if (/\bgit\s+worktree\s+(?:remove|prune|move)\b/i.test(text)) actions.add("shell-write");
  if (/\bgh\s+(?:release\s+(?:create|delete|edit|upload)|secret\s+(?:set|delete)|repo\s+(?:create|delete|edit|rename)|workflow\s+(?:run|enable|disable))\b/i.test(text)) {
    actions.add("external-write");
  }
  if (/\b(?:npm|pnpm|yarn|bun)\s+(?:-[^\s]+\s+)*(?:install|i|ci|add|remove|uninstall|update|upgrade|link)\b|\bpip3?\s+install\b|\bpipx\s+install\b|\buv\s+(?:pip\s+install|add|remove)\b|\bbrew\s+(?:install|uninstall|upgrade)\b|\bpod\s+(?:install|update)\b|\bnpx\s+pod-install\b|\bgem\s+install\b|\bcargo\s+(?:install|add)\b|\bnpx\s+expo\s+install\b/i.test(text)) {
    actions.add("install");
  }
  if (/\bxcodebuild\b|\bexpo\s+run:|\beas(?:-cli)?\s+build\b|\bnpm\s+run\s+ios:device\b/i.test(text)) actions.add("build");
  if (/\beas(?:-cli)?\s+(?:submit|update)\b|\b(?:vercel|render|wrangler|fly|firebase)\s+deploy\b|\bvercel\b[^;|&]*--prod\b|\bwrangler\s+(?:publish|secret\s+put)\b/i.test(text)) {
    actions.add("deploy");
  }
  if (/\bsed\s+(?:-[^\s]*\s+)*-i\b|\bsed\s+-i\b|\bperl\s+[^;|&]*-i\b|(?:^|[;|&]\s*)patch\b/i.test(text)) actions.add("edit-files");
  for (const target of redirectTargets(text)) {
    if (isCodeMutationPath(target)) {
      actions.add("edit-files");
      paths.add(target);
    }
  }
  const deletions = deletionTargets(text);
  if (deletions.length > 0 && deletions.some((target) => !SAFE_DELETE_RX.test(target))) {
    actions.add("delete-files");
    deletions.forEach((target) => paths.add(target));
  }
  if (/\bfind\b[^;|&]*\s-(?:delete\b|exec\s+rm\b)/i.test(text)) actions.add("delete-files");
  for (const match of text.matchAll(/(?:^|[;|&]\s*|\s)(?:mv|cp)\s([^;|&]*)/g)) {
    const words = shellWords(match[1]).filter((word) => !word.startsWith("-"));
    const destination = words.length >= 2 ? words[words.length - 1] : "";
    if (destination && isCodeMutationPath(destination)) {
      actions.add("edit-files");
      paths.add(destination);
    }
  }
  if (/\bcurl\b[^;|&]*(?:-X\s*["']?(?:POST|PUT|PATCH|DELETE)|--request\s+["']?(?:POST|PUT|PATCH|DELETE)|(?:^|\s)(?:-d|--data(?:-\w+)?|-F|--form|--upload-file|-T)(?:\s|=))/i.test(text)) {
    actions.add("external-write");
  }
  const apiMutation = githubApiMutation(text, scope);
  apiMutation.actions.forEach((action) => actions.add(action));
  apiMutation.destinations.forEach((destination) => destinations.add(destination));
  if (actions.size > 0) {
    commandDestinations(text, scope).forEach((destination) => destinations.add(destination));
  }
  return { actions, paths, destinations };
};

const DESTRUCTIVE_NAME_RX = /(?:^|__|_)(?:delete|remove|destroy|drop|refund|charge|transfer|deploy|merge|publish|release|uninstall|install|revoke|purge|wipe|push)(?:_|$)/i;

const commissionsCodeWrite = (brief) =>
  /\b(?:implement|refactor|rewrite|migrate|hotfix)\b/i.test(brief)
  || /\b(?:fix|edit|modify|patch|apply)\b[\s\S]{0,80}?\b(?:code|bug|src\/|\.[cm]?[jt]sx?\b|\.py\b|\.rb\b|\.go\b|\.swift\b|\.kt\b)/i.test(brief)
  || /\b(?:commit|push|merge|deploy|install)\b/i.test(brief)
  || /\b(?:open|raise|create)\s+(?:a\s+|the\s+)?(?:pr|pull request)\b/i.test(brief);

const extractWrappedCommands = (source) => {
  const commands = [];
  const pattern = /\bcmd\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  for (const match of String(source || "").matchAll(pattern)) {
    try {
      commands.push(match[1].startsWith('"')
        ? JSON.parse(match[1])
        : match[1].slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\"));
    } catch {
      return [];
    }
  }
  return commands;
};

const delegationScope = (brief) => {
  const normalizedBrief = String(brief || "");
  const positiveBrief = normalizedBrief.replace(/\bdo not\s+(?:edit|write|change|implement|fix|commit|push|merge|deploy|build|install|delete|remove)(?:\s+files?)?\b/gi, "");
  const readOnly = /\b(read-only|investigate|inspect|review|audit|analy[sz]e|research|benchmark|compare|precedent|report)\b/i.test(normalizedBrief)
    && !/\b(implement|edit|write|change|fix|commit|push|merge|deploy|build|install|delete|remove)\b/i.test(positiveBrief);
  return {
    readOnly,
    scopeMeta: mergeScopeMeta(scopeMetaFromText(normalizedBrief), {
      ...emptyScopeMeta(),
      actions: ["write"],
      systems: ["code"]
    })
  };
};

const mutationEnvelope = (name, value, mutation, scope) => {
  if (!mutation) return { actions: [], paths: [], destinations: [], environments: [] };
  const lower = String(name || "").toLowerCase();
  const command = commandFrom(value);
  const actions = new Set();
  const paths = new Set();
  const destinations = new Set();
  const addPath = (candidate) => {
    if (typeof candidate === "string" && candidate.trim()) paths.add(candidate.trim());
  };

  if (/^(?:write|edit|multiedit|notebookedit|apply_patch|tools\.apply_patch|functions\.apply_patch)$/i.test(lower)) {
    actions.add(/delete/i.test(String(value?.operation || "")) ? "delete-files" : "edit-files");
    addPath(value?.file_path || value?.path);
    patchPaths(value).forEach(addPath);
    if (paths.size === 0) addPath(".");
  } else if (/^(?:agent|task|spawn_agent|collaboration\.spawn_agent|send_message|followup_task|collaboration\.(?:send_message|followup_task))$/i.test(lower)) {
    actions.add("delegate-write");
  } else if (/^request_plugin_install$/i.test(lower)) {
    actions.add("install");
    const destination = externalDescriptor(lower, value);
    if (destination) destinations.add(destination);
  } else if (/^(?:bash|shell|exec_command|functions\.exec_command)$/i.test(lower)) {
    const profile = shellMutationProfile(command, scope);
    profile.actions.forEach((action) => actions.add(action));
    profile.paths.forEach(addPath);
    profile.destinations.forEach((destination) => destinations.add(destination));
    if (actions.size === 0) actions.add("shell-write");
    patchPaths({ source: command }).forEach(addPath);
    if (["edit-files", "delete-files", "shell-write"].some((action) => actions.has(action)) && paths.size === 0) {
      addPath(".");
    }
  } else if (/^functions\.exec$/i.test(lower)) {
    const wrappedTools = nestedToolCalls(command);
    if (wrappedTools.some((call) => call.name === "apply_patch")) actions.add("edit-files");
    for (const wrapped of extractWrappedCommands(command)) {
      const profile = shellMutationProfile(wrapped, scope);
      profile.actions.forEach((action) => actions.add(action));
      profile.paths.forEach(addPath);
      profile.destinations.forEach((destination) => destinations.add(destination));
    }
    if (actions.size === 0) actions.add("shell-write");
    if (["edit-files", "delete-files", "shell-write"].some((action) => actions.has(action)) && paths.size === 0) {
      addPath(".");
    }
  } else {
    actions.add("external-write");
    const externalName = /mcp_tool_call/i.test(lower)
      ? String(value?.tool_name || value?.name || lower).toLowerCase()
      : lower;
    const destination = externalDescriptor(externalName, value);
    if (destination) destinations.add(destination);
  }
  const shellTool = /^(?:bash|shell|exec_command|functions\.exec|functions\.exec_command)$/i.test(lower);
  const environmentSource = shellTool
    ? command
    : [value?.environment, value?.target_environment, value?.targetEnvironment].filter(Boolean).join(" ");
  const environments = scopeMetaFromText(environmentSource).environments;
  return {
    actions: [...actions].sort(),
    paths: [...paths].sort(),
    destinations: [...destinations].sort(),
    environments
  };
};

const toolScope = (name, value) => {
  const lower = String(name || "").toLowerCase();
  const command = commandFrom(value);
  let mutation = false;
  let scopeMeta = emptyScopeMeta();

  const nestedArguments = value?.arguments && typeof value.arguments === "object"
    ? value.arguments
    : {};
  const readOnlyHint = [
    value?.annotations,
    nestedArguments?.annotations,
    input?.annotations,
    input?.tool_input?.annotations,
    input?.arguments?.annotations
  ].some((annotations) => annotations?.read_only_hint === true);
  const hintedName = /mcp_tool_call/i.test(lower)
    ? String(value?.tool_name || value?.name || nestedArguments?.tool_name || nestedArguments?.name || lower).toLowerCase()
    : lower;
  const semanticallyReadOnly = /(?:^|__|_)(?:read|get|list|search|lookup|find|fetch|view|inspect|query)(?:_|$)/i.test(hintedName)
    && !/(?:^|__|_)(?:write|edit|create|update|delete|remove|save|send|post|publish|push|merge|deploy|release|install|build|charge|refund|transfer|invite|share|email|message)(?:_|$)/i.test(hintedName);
  if (readOnlyHint && semanticallyReadOnly) {
    return { mutation: false, scopeMeta };
  }
  if (/^(?:read|grep|glob|ls|find|view_image|websearch|webfetch|web__run|request_user_input|get_goal|list_mcp_resources|list_mcp_resource_templates|read_mcp_resource|list_agents|wait_agent|collaboration\.(?:list_agents|wait_agent)|open|screenshot|toolsearch|skill|senduserfile|reportfindings|askuserquestion|taskcreate|taskget|tasklist|taskupdate|taskoutput|taskstop|monitor|schedulewakeup|enterplanmode|exitplanmode|enterworktree|exitworktree|croncreate|cronlist|crondelete|pushnotification|listmcpresourcestool|readmcpresourcetool|readmcpresourcedirtool|artifact|designsync|todowrite|todoread|workflow|remotetrigger|endconversation|image_gen__imagegen|imagegen|generated_image)$/i.test(lower)) {
    return { mutation: false, scopeMeta };
  }

  if (/^(?:agent|task|spawn_agent|collaboration\.spawn_agent)$/i.test(lower)) {
    const brief = String(value?.prompt || value?.message || value?.description || "");
    const delegation = delegationScope(brief);
    if (delegation.readOnly || !commissionsCodeWrite(brief)) return { mutation: false, scopeMeta };
    mutation = true;
    scopeMeta = delegation.scopeMeta;
  } else if (/^(?:send_message|followup_task|collaboration\.(?:send_message|followup_task))$/i.test(lower)) {
    const brief = String(value?.message || value?.prompt || value?.description || "");
    const delegation = delegationScope(brief);
    if (delegation.readOnly || !commissionsCodeWrite(brief)) return { mutation: false, scopeMeta };
    mutation = true;
    scopeMeta = delegation.scopeMeta;
  } else if (/^(?:write_stdin|functions\.write_stdin)$/i.test(lower)) {
    return { mutation: false, scopeMeta };
  } else if (/^request_plugin_install$/i.test(lower)) {
    mutation = true;
    scopeMeta = mergeScopeMeta(scopeMetaFromText(lower), {
      ...emptyScopeMeta(),
      actions: ["install"],
      consequences: ["external-state"]
    });
  } else if (/^(?:write|edit|multiedit|notebookedit|apply_patch|tools\.apply_patch|functions\.apply_patch)$/i.test(lower)) {
    const targets = [value?.file_path, value?.path, ...patchPaths(value)]
      .filter((candidate) => typeof candidate === "string" && candidate.trim());
    if (targets.length > 0 && !targets.some(isCodeMutationPath)) {
      return { mutation: false, scopeMeta };
    }
    mutation = true;
    scopeMeta = mergeScopeMeta(scopeMetaFromText(`change code ${value?.file_path || value?.path || ""}`), {
      ...emptyScopeMeta(),
      actions: ["write"],
      systems: ["code"]
    });
  } else if (/^(?:bash|shell|exec_command|functions\.exec_command)$/i.test(lower)) {
    const profile = shellMutationProfile(command, { branch: "" });
    if (profile.actions.size === 0) {
      return { mutation: false, scopeMeta };
    }
    mutation = true;
    const semanticCommand = command.replace(/\brm\b/g, "delete").replace(/\bunlink\b/g, "delete");
    scopeMeta = scopeMetaFromText(semanticCommand);
    if (scopeMeta.actions.length === 0) {
      scopeMeta = mergeScopeMeta(scopeMeta, {
        ...emptyScopeMeta(),
        actions: ["write"],
        systems: ["code"]
      });
    }
  } else if (/^functions\.exec$/i.test(lower)) {
    const wrappedCommands = extractWrappedCommands(command);
    const wrappedTools = nestedToolCalls(command);
    const wrapperAppliesPatch = wrappedTools.some((call) => call.name === "apply_patch");
    const wrappedMutation = wrappedCommands.some((wrapped) => shellMutationProfile(wrapped, { branch: "" }).actions.size > 0);
    if (!wrapperAppliesPatch && !wrappedMutation) {
      return { mutation: false, scopeMeta };
    }
    mutation = true;
    scopeMeta = mergeScopeMeta(scopeMetaFromText(command), {
      ...emptyScopeMeta(),
      actions: ["write"],
      systems: ["code"]
    });
  } else {
    if (!DESTRUCTIVE_NAME_RX.test(hintedName)) {
      return { mutation: false, scopeMeta };
    }
    mutation = true;
    scopeMeta = mergeScopeMeta(scopeMetaFromText(hintedName), {
      ...emptyScopeMeta(),
      actions: ["external-write"],
      consequences: ["external-state"]
    });
  }

  return { mutation, scopeMeta };
};

const requested = toolScope(toolName, toolInput);
if (!requested.mutation) {
  respondJson();
  process.exit(0);
}
const resolvedScope = resolveScope(input);
const requestedEnvelope = mutationEnvelope(toolName, toolInput, requested.mutation, resolvedScope);

const enforcement = String(process.env.OUTER_ENFORCEMENT || "enforce").toLowerCase();
const stateResult = readState(input);
let reason = "OUTER v3 has no confirmed task for this client, session, repository, and branch. Continue read-only and present the required task-scoped action confirmation.";
let expansion = null;
const resetWithChallenge = (record, scopeMeta) => {
  const phrase = createApprovalPhrase();
  const saved = writeState(input, {
    ...(record || {}),
    lifecycle: "UNASSESSED",
    taskHash: record?.taskHash || "",
    scopeMeta,
    confirmationEnvelope: null,
    pendingConfirmationEnvelope: null,
    pendingApprovalPhraseHash: approvalPhraseHash(phrase)
  });
  return saved.error ? "" : phrase;
};
const expansionChallenge = (record, scopeMeta) => {
  const phrase = createApprovalPhrase();
  const saved = writeState(input, {
    ...(record || {}),
    scopeMeta,
    pendingApprovalPhraseHash: approvalPhraseHash(phrase)
  });
  return saved.error ? "" : phrase;
};
const challengeInstruction = (phrase) => phrase
  ? ` Render the fresh confirmation with Approval phrase: ${phrase} and end exactly: Reply exactly: ${phrase}`
  : " Mutation remains fail-closed because a fresh approval challenge could not be persisted.";

if (stateResult.error) {
  reason = "OUTER v3 could not read isolated confirmation state. Mutation is fail-closed until session state recovers.";
} else if (stateResult.expired) {
  const phrase = resetWithChallenge(null, requested.scopeMeta);
  reason = "OUTER v3 confirmation expired. Reassess the current repository, branch, environment, and blast radius."
    + challengeInstruction(phrase);
} else if (stateResult.record) {
  const lifecycle = stateResult.record.lifecycle;
  if (["CONFIRMED", "ACTIVE"].includes(lifecycle)) {
    if (envelopeAllows(
      stateResult.record.confirmationEnvelope,
      requestedEnvelope.actions,
      requestedEnvelope.paths,
      requestedEnvelope.destinations,
      requestedEnvelope.environments,
      resolvedScope.repoRoot
    )) {
      if (lifecycle === "CONFIRMED") {
        writeState(input, { ...stateResult.record, lifecycle: "ACTIVE" });
      }
      respondJson();
      process.exit(0);
    }
    const phrase = expansionChallenge(
      stateResult.record,
      mergeScopeMeta(stateResult.record.scopeMeta, requested.scopeMeta)
    );
    reason = "OUTER v3 blocked this mutation because its exact action, path, destination, or environment is outside the approved confirmation. The existing approval stays armed for its own scope and work inside it may continue. To add this action, render an expansion confirmation covering the union of the approved and new scope."
      + challengeInstruction(phrase);
  } else if (lifecycle === "SKIPPED") {
    if (envelopeAllows(
      stateResult.record.bypassEnvelope,
      requestedEnvelope.actions,
      requestedEnvelope.paths,
      requestedEnvelope.destinations,
      requestedEnvelope.environments,
      resolvedScope.repoRoot
    )) {
      respondJson();
      process.exit(0);
    }
    expansion = scopeExpansion(stateResult.record.scopeMeta, requested.scopeMeta);
    const expandedScope = mergeScopeMeta(stateResult.record.scopeMeta, requested.scopeMeta);
    const phrase = resetWithChallenge(stateResult.record, expandedScope);
    reason = "OUTER v3 blocked this mutation because task-scoped Skip does not cover its exact action, path, destination, or environment"
      + (hasExpansion(expansion) ? ` (${compactExpansion(expansion)})` : "") + "."
      + challengeInstruction(phrase);
  } else if (["UNASSESSED", "NEEDS_CLARIFICATION", "AWAITING_OK"].includes(lifecycle)) {
    if (lifecycle === "AWAITING_OK") {
      reason = "OUTER v3 has rendered a scoped confirmation and is waiting for the user's exact task-specific phrase. Continue read-only.";
    } else {
      const phrase = resetWithChallenge(
        stateResult.record,
        mergeScopeMeta(stateResult.record.scopeMeta, requested.scopeMeta)
      );
      reason = "OUTER v3 detected mutation but no complete rendered confirmation is armed. Detection, a reminder, or generic approval is not consent. Continue read-only."
        + challengeInstruction(phrase);
    }
  } else {
    const phrase = resetWithChallenge(stateResult.record, requested.scopeMeta);
    reason = "OUTER v3 task state is " + lifecycle + ". Mutation requires a new assessment and task-specific phrase."
      + challengeInstruction(phrase);
  }
} else {
  const phrase = resetWithChallenge(null, requested.scopeMeta);
  reason += challengeInstruction(phrase);
}

if (enforcement === "advisory") {
  respondJson({
    outerAdvisory: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: `${reason} OUTER_ENFORCEMENT=advisory is allowing the host to continue as an emergency rollback mode.`
    }
  });
  process.exit(0);
}

respondJson({
  decision: "block",
  reason,
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason
  }
});
