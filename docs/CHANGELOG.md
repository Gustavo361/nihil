# Changelog

Histórico das funcionalidades e mudanças relevantes do Nihil.
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/).
Versões semânticas quando houver releases; até lá, entradas por data/etapa.

Atualizar este arquivo **na preparação para commit** (ou quando o responsável pedir), não a cada alteração intermediária.

## [Unreleased]

### Added

- Migração Flyway `V2` com schema operacional inicial para usuários/permissões, funcionários, fornecedores, estoque, cardápio, compras, vendas, despesas, folha e caixa.
- UI `/fornecedores`: fornecedores, entregas programadas e lembretes no cabeçalho (localStorage).
- UI `/despesas`: lançamentos, recorrências, confirmação de pagamento/cancelamento e visão financeira (localStorage).
- UI `/funcionarios`, `/folha` e `/cargos-permissoes`: cadastro de equipe, folha registrada e permissões locais de acesso.
- Ajustes de operação em Caixa, Compras, Estoque e Vendas; controles de valor monetário e select reutilizáveis.
- UI `/pratos-receitas`: cadastro de pratos, receita em g/kg, custo estimado; catálogo compartilhado com Vendas (só disponíveis com ingredientes); localStorage.
- UI `/compras`: cadastro/entrada de produtos no estoque (peso de pacote quando necessário); produtos nascem só em Compras.
- Estoque por dia: início, entradas, saídas estimadas, conferência física; baixa estimada de vendas de pratos com receita (cancelamento reverte).
- UI/UX do módulo Estoque (mock local, sem API): listagem, filtros, paginação, KPIs, detalhe com histórico e modal de movimentação com cadastro rápido de item.
- Menus do header (notificações e modo claro/escuro) com dropdown e seta.
- Locale `pt-BR` no frontend para formatação monetária.
- Fundação do monólito modular: backend Spring Boot 4.1.2 (Java 21) e frontend Angular 22 + pnpm.
- Perfis de backend `smoke` (H2), `dev`/`prod` (PostgreSQL via `DB_*`), `test` (H2).
- Flyway com baseline `V1__foundation_baseline.sql`.
- Actuator health em `/actuator/health`.
- Banner nativo Spring Boot (`backend/src/main/resources/banner.txt`): NIHIL, versão Maven (`nihil.version` / `@project.version@`), Java, Spring Boot, perfil, porta.
- Scripts Windows em `scripts/` (`setup`, `dev`, `stop` — `.cmd` + `.ps1`).
- Atalhos na raiz: `dev.cmd`, `setup.cmd`, `stop.cmd` e `package.json` com `pnpm dev` / `npm run dev` (orquestração do monorepo).
- Documentação: `README.md`, `AGENTS.md`, `docs/PROJECT_BIBLE.md`, ADRs, `CHANGELOG.md`, `PROJECT_LOG.md`.

### Changed

- Rotas de Fornecedores, Despesas, Funcionários, Folha e Cargos e permissões passaram a usar as telas implementadas.
- UI `/estoque`: toolbar Dia + CTAs (registrar entradas / iniciar conferência) em linha; modais de entrada e conferência do dia (com cadastro de produto se faltar); KPI “Conferência do dia”; coluna Saldo usa contagem quando houver; tooltips nas colunas da tabela; label “Saídas estimadas”.
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
