# The gate

These four scripts turn OUTER from advice into a refusal. Without them the
agent follows the interview because the skill tells it to. With them, a write
is blocked at the door until your exact approval phrase is on record.

**Read this before you rely on it.** The gate is a denylist. It recognises a
list of dangerous shapes and refuses those; anything it does not recognise
passes through. Writes and edits to source files, git operations, installs,
builds, deploys and destructive shell commands are covered. An interpreter
one-liner such as `node -e "require('fs').writeFileSync(...)"` is not. Nor is a
write to `~/.claude/settings.json`, which is the file that registers these
hooks. Nor is an MCP tool whose name carries no known destructive verb.

So this is a firm stop on the routes an agent takes by default. It is not a
sandbox, and it does not protect its own configuration. If you need a boundary
that holds against everything, put the agent in a container and use this for
the conversation it forces first.

Requires Node.js 18 or later. No dependencies, no install step, no network.

## What each script does

| Script | Runs when | Job |
|---|---|---|
| `outer-interview-trigger.mjs` | You submit a prompt | Judges clarity and blast radius. Detects an approval phrase and arms it. Never treats a reminder as consent. |
| `outer-pre-mutation-gate.mjs` | Before any tool call | The enforcement boundary. Lets reads through, refuses writes without a matching approval. |
| `outer-confirmation-stop.mjs` | End of a turn | Checks the confirmation was complete and binds its phrase to this exact task. |
| `outer-state.mjs` | Imported by the others | Shared state. Stores hashes and status words only. |

## Put them somewhere stable

```bash
git clone https://github.com/Shivak11/outer-engineering-loop.git ~/.outer
```

The scripts read and write a small state file under your system temp directory
(`outer-v3/`). Set `OUTER_HOOK_STATE_DIR` if you want it elsewhere.

## Claude Code

Add these three entries to the `hooks` block of `~/.claude/settings.json`.
Keep any hooks you already have; these merge alongside them.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ {
        "type": "command",
        "command": "env OUTER_CLIENT=claude node ~/.outer/hooks/outer-interview-trigger.mjs",
        "timeout": 5
      } ] }
    ],
    "PreToolUse": [
      { "matcher": "*", "hooks": [ {
        "type": "command",
        "command": "env OUTER_CLIENT=claude node ~/.outer/hooks/outer-pre-mutation-gate.mjs",
        "timeout": 5
      } ] }
    ],
    "Stop": [
      { "hooks": [ {
        "type": "command",
        "command": "env OUTER_CLIENT=claude node ~/.outer/hooks/outer-confirmation-stop.mjs",
        "timeout": 5
      } ] }
    ]
  }
}
```

Some Claude Code versions do not expand `~` inside a hook command. If the hooks
appear to do nothing, replace `~/.outer` with the full path.

## Codex

Same three entries in `~/.codex/hooks.json`, with `OUTER_CLIENT=codex` so the
two clients keep separate approval state.

## Check it actually works

Restart your agent first. Configuration on disk is not the same as a hook the
host has loaded.

1. Ask it to read a file. This should work normally. The gate lets reads
   through.
2. Ask it to change a file. It should show a confirmation and refuse to write.
3. Type the exact phrase. The write should now go through.

If step 2 writes the file, the hooks are not loaded. Check the path in your
settings and restart again.

## Turning it off

Remove the three entries, or set `OUTER_ENFORCEMENT=advisory` in your
environment as an emergency escape. Advisory mode warns loudly and records that
enforcement was missing. Use it to get unstuck, not as a permanent setting.

`[skip-outer]` in your message is the per-task escape and does not need any of
this. It authorises only the actions you named in that one message.
