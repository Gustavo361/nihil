# ADR 0003 — Database strategy

- Status: Accepted (updated 2026-11-02)
- Date: 2026-11-02

## Context

The system needs a relational store with strong integrity for stock and money. Neon is planned for hosted PostgreSQL. Automated tests and a local smoke boot must run without a remote database. Docker is out of scope for local development.

## Decision

- PostgreSQL installed locally for the `dev` profile; Neon (or equivalent) for `prod`.
- Connection settings via environment variables (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`). `DB_PASSWORD` has no default in `dev`/`prod`.
- Flyway for versioned migrations; foundation ships only a non-business baseline.
- H2 (PostgreSQL compatibility mode) for:
  - `test` — automated tests
  - `smoke` — optional local boot without PostgreSQL
- No Docker Compose or containerized database in this repository.

## Consequences

- Real development (`dev`) requires a reachable local PostgreSQL and env credentials.
- Smoke/tests can run without installing PostgreSQL.
- No secrets are stored in the repository.
