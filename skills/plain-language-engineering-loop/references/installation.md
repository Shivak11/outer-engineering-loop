# Installing and invoking OUTER

## The skill

```bash
npx skills add Shivak11/outer-engineering-loop
```

This works for Claude Code, Codex, Cursor, and the other agents the `skills`
CLI supports. Add `-g` to install for every project instead of the current one.

To install by hand, copy `skills/plain-language-engineering-loop/` into your
agent's skills directory:

| Client | User-wide | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/plain-language-engineering-loop/` | `.claude/skills/plain-language-engineering-loop/` |
| Codex | `~/.agents/skills/plain-language-engineering-loop/` | `.agents/skills/plain-language-engineering-loop/` |

## Invoking it

- Claude Code: `/plain-language-engineering-loop <task>`
- Codex: `$plain-language-engineering-loop <task>`
- Any agent: "Use the plain-language engineering loop for this task."

The skill also triggers on its own for substantial work: features, bug fixes,
refactors, migrations, integrations, deployments, and releases. It stays quiet
for explanation-only questions, research, and trivial prose edits.

## Enforcement

The skill on its own is guidance the agent follows. To have writes actually
refused until you type the approval phrase, wire the three hooks described in
`hooks/README.md` at the repository root.

The prompt hook is advisory: it assesses clarity and blast radius, and never
treats its own reminder as consent. The stop hook arms only a complete
confirmation carrying the current generated phrase. The mutation hook is where
refusal actually happens.

That mutation hook classifies by denylist, so it covers the shapes it
recognises and passes the rest. `hooks/README.md` lists what is covered and
what is not. Read it before treating the gate as a boundary.

An approval is scoped by client, operating-system user, session, repository,
branch, action classes, exact path hashes, exact destination hashes, and
intended environment. Expanding any of those invalidates the phrase and
requires a fresh confirmation.

## Escapes

`[skip-outer]` records a bypass along with the single most important
unexamined risk. It authorises only the actions and paths named in that
message. It is not permission to merge, deploy, delete, purchase, expose data,
or widen scope.

`OUTER_ENFORCEMENT=advisory` is the emergency rollback for a broken hook. It
must warn clearly and record the missing enforcement. It never weakens a
repository's own commit, pull request, merge, deployment, or release gates.

## Proving the install

An installed file is not proof that the client discovered the skill, and a
configured hook is not proof that the host executed it. Restart the client,
run one read (which should pass) and one write (which should be refused), and
only then call the installation done.
