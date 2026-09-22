# Finance

Android personal finance app. Offline-first, with all data stored locally on
the phone.

It replaces the off-the-shelf app Jose used before and adds what that one had
no answer for: foreign-currency accounts with the real rate of each
transaction, interest and cashback kept separate from the account balance, and
a module to estimate income tax and know how much to save each month.

## Stack

Angular + Ionic + Capacitor + local SQLite.

## Where to start

1. `SETUP.md` — installation, Git and GitHub, step by step
2. `CLAUDE.md` — context and decisions (Claude Code reads it on its own)
3. `docs/04-stack-guide.md` — the stack explained coming from .NET/Angular
4. `docs/05-data-model.md` — the schema, and why it is shaped that way
5. `docs/06-schema.md` — the schema drawn, with the ER diagram
6. `docs/03-roadmap.md` — what comes next

## Status

Phase 3 in progress. The database layer is done and tested, and the Ionic app
covers the summary, accounts, categories, yields, the income-tax simulator and
import/export of backups. Every movement is entered by hand.

```
npm install
npm start          # ionic serve
npm run db:test    # the database tests, no build step needed
```
