# Getting started, step by step

Written for someone who has never set up a personal project on GitHub.
Follow the order. Do not skip steps.

---

## Step 1 — Install what you need

Install in this order:

1. **Git** — https://git-scm.com/download/win
   Leave every installer option at its default. Just make sure the option to
   add Git to the PATH stays checked.

2. **Node.js LTS** — https://nodejs.org
   Pick the LTS version (the one on the left), not "Current".

3. **Android Studio** — https://developer.android.com/studio
   It is heavy (several GB) and slow. Let it install while you do something
   else. The first time you open it, accept the wizard that downloads the SDK.

4. **JDK 17** — Android Studio usually ships it. Verify afterwards.

You already have VS Code.

**Check that everything landed.** Open a new terminal (PowerShell) and run:

```bash
git --version
node --version
npm --version
```

If any of them fails with "command not found", close the terminal and open a
new one. If it still fails, it did not make it into the PATH.

Then install the Ionic CLI:

```bash
npm install -g @ionic/cli
ionic --version
```

---

## Step 2 — Configure Git for the first time

Done once per computer, for life:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

The email must be the same one you use for the GitHub account.

---

## Step 3 — Create the project folder

Pick where it will live. For example `C:\DEV\Finance`.

Unzip the files there. You should end up with:

```
Finance/
  CLAUDE.md
  README.md
  SETUP.md
  .gitignore
  docs/
    02-technical-decisions.md
    03-roadmap.md
    04-stack-guide.md
```

---

## Step 4 — Turn it into a Git repository

Open a terminal **inside that folder** and run:

```bash
git init
git add .
git commit -m "Initial project context"
```

What you just did, in plain words:

- `git init` → tells Git "watch this folder"
- `git add .` → "stage all these files to be saved"
- `git commit` → "save a snapshot of the current state with this message"

A commit is a point you can always come back to. Commit often.

---

## Step 5 — Push it to GitHub

1. Create an account at https://github.com if you do not have one.
2. **+** button at the top right → **New repository**.
3. Name: `finance`. Check **Private**.
4. Do **not** check any of the boxes that initialize a README, .gitignore or
   license. You already have them locally and they would clash.
5. Create.

GitHub will show you some commands. Use the ones under "push an existing
repository":

```bash
git remote add origin https://github.com/YOUR-USERNAME/finance.git
git branch -M main
git push -u origin main
```

It will ask you to authenticate. The browser opens, you authorize, done.

Refresh the GitHub page: your files should be there.

### The cycle from here on

Every time you work:

```bash
git add .
git commit -m "description of what you did"
git push
```

That is enough for now. Branches, merges and pull requests come later, when
they are actually needed; for a one-person project you do not need them yet.

---

## Step 6 — Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Then, **from inside the project folder**:

```bash
cd C:\DEV\Finance
claude
```

The first time it asks you to authenticate with your Anthropic account.

Claude Code reads `CLAUDE.md` automatically on startup, so it arrives with all
the context of what we decided. You do not have to explain anything again.

You can also use it from VS Code by installing the Claude Code extension, if
you prefer having it next to the editor instead of in a separate terminal.

---

## Step 7 — First message in Claude Code

When you start, something like:

```
Read CLAUDE.md and docs/. Let's do Phase 1 of the roadmap:
the data model and the SQLite schema.
Before writing code, show me the proposed table design
so we can review it.
```

From there the conversation continues over there, with access to the real code.

---

## Notes

- The Angular/Ionic project **does not exist yet**. It gets created in Phase 1,
  from Claude Code, so you can see every step.
- If something in the setup fails, the exact error is the best clue. Paste it
  verbatim into Claude Code — it gets resolved faster than searching blind.
