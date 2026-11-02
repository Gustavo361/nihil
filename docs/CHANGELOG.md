# Changelog

Histórico das funcionalidades e mudanças relevantes do Nihil.
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/).
Versões semânticas quando houver releases; até lá, entradas por data/etapa.

Atualizar este arquivo **na preparação para commit** (ou quando o responsável pedir), não a cada alteração intermediária.

## [Unreleased]

### Added

- Fundação do monólito modular: backend Spring Boot 4.1.2 (Java 21) e frontend Angular 22 + pnpm.
- Perfis de backend `smoke` (H2), `dev`/`prod` (PostgreSQL via `DB_*`), `test` (H2).
- Flyway com baseline `V1__foundation_baseline.sql`.
- Actuator health em `/actuator/health`.
- Banner nativo Spring Boot (`backend/src/main/resources/banner.txt`): NIHIL, versão Maven (`nihil.version` / `@project.version@`), Java, Spring Boot, perfil, porta.
- Scripts Windows em `scripts/` (`setup`, `dev`, `stop` — `.cmd` + `.ps1`).
- Atalhos na raiz: `dev.cmd`, `setup.cmd`, `stop.cmd` e `package.json` com `pnpm dev` / `npm run dev` (orquestração do monorepo).
- Documentação: `README.md`, `AGENTS.md`, `docs/PROJECT_BIBLE.md`, ADRs, `CHANGELOG.md`, `PROJECT_LOG.md`.

### Changed

- Removido Docker do fluxo local.
- `dev` sobe backend + frontend **no mesmo terminal**; Job Object + `stop` no Ctrl+C.
- Saída do `dev`: banner do backend → portas juntas (● verde) só quando frontend e backend respondem HTTP; erros relevantes no terminal; sem arquivo de log persistente.
- Analytics do Angular desativado (`NG_CLI_ANALYTICS` + `~/.angular-config.json`).
- Docs de progresso (`CHANGELOG` / `PROJECT_LOG` / marcações na Bíblia) só antes de commit ou quando pedido explicitamente.

### Fixed

- Descoberta de `JAVA_HOME` / conflito PowerShell `$HOME` no `dev.ps1`.
- Removido goal Maven `build-info` (versão via resource filtering).
- Builds nativos pnpm 12 (`dangerously-allow-all-builds`).

## [0.0.1] — 2026-11-02

Fundação inicial do repositório Nihil (sem módulos de negócio: estoque, vendas, etc.).
