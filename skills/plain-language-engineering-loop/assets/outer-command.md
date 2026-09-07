---
description: Assess a task with OUTER v3 and confirm consequential changes before mutation
argument-hint: [task to build, fix, refactor, migrate, integrate, or release]
allowed-tools: Skill, AskUserQuestion, Read, Glob, Grep, Bash
---

Invoke the `plain-language-engineering-loop` skill for this task:

$ARGUMENTS

First assess the objective, repository, branch, environment, reversibility, evidence bar, and blast radius. Ask only the smallest set of plain-English questions a senior engineer genuinely needs answered. Read-only investigation may continue.

When the task is sufficiently clear, state one emphatic action confirmation containing the exact repository, branch, environment, allowed mutations, allowed paths, allowed external destinations, exclusions, affected systems, verification, recovery, and generated `APPROVE OUTER-XXXXXXXX` phrase. End with the exact copy instruction for that phrase. Do not mutate anything until the user types that exact task-specific phrase.
