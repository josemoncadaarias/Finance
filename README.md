# Finance

Android personal finance app. Offline-first, with all data stored locally on
the phone.

It replaces Monefy and adds what Monefy is missing: foreign-currency accounts
with the real rate of each transaction, interest and cashback kept separate
from the account balance, and a module to estimate income tax and know how
much to save each month.

## Stack

Angular + Ionic + Capacitor + local SQLite.

## Where to start

1. `SETUP.md` — installation, Git and GitHub, step by step
2. `CLAUDE.md` — context and decisions (Claude Code reads it on its own)
3. `docs/04-stack-guide.md` — the stack explained coming from .NET/Angular
4. `docs/05-data-model.md` — the schema, and why it is shaped that way
5. `docs/03-roadmap.md` — what comes next

## Status

Phase 1. The data model and SQLite schema are done and tested; the Angular
project is not scaffolded yet. See `docs/05-data-model.md`.
