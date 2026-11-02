# AGENTS.md — instruções para assistentes de IA

Leia `docs/PROJECT_BIBLE.md` antes de implementar qualquer coisa. Este arquivo resume o contrato operacional com a IA.

## Missão

Nihil é um sistema **interno** de gestão para restaurante (estoque, compras, cardápio, vendas internas, financeiro, funcionários e folha). Não é um iFood.

## Regras obrigatórias

1. Implementar apenas o escopo pedido. Sem refatorações laterais.
2. Não inventar regras de negócio, fórmulas financeiras ou trabalhistas.
3. Não colocar segredos no repositório (`.env`, tokens, dumps).
4. Valores monetários em Java: `BigDecimal`. No banco: `NUMERIC`/`DECIMAL`.
5. Mudanças de schema apenas via Flyway (nova migração; não editar migrações já aplicadas em ambientes compartilhados).
6. Não criar camadas/interfaces/abstrações sem necessidade real.
7. Não declarar “testado” sem executar o comando e registrar o resultado.
8. Não fazer commit ou push sem autorização explícita do responsável.
9. Preferir Conventional Commits em inglês quando um commit for solicitado.
10. Atualizar `docs/CHANGELOG.md`, `docs/PROJECT_LOG.md` e marcações de progresso na Bíblia **somente na preparação para commit** (ou quando o responsável pedir documentação/commit explicitamente) — **não** a cada prompt/tarefa intermediária. O trabalho entre commits pode mudar muitas vezes; documentar cedo demais gera ruído e histórico falso. ADRs/Bíblia de decisões estruturais: só quando a decisão estiver estável o bastante para entrar no próximo commit.

## Estrutura

- `backend/` — Spring Boot modular monolith (`com.nihil.*`)
- `frontend/` — Angular + pnpm, organizado por features + `core` + `shared`
- `docs/` — Bíblia, arquitetura, ADRs, requisitos, `CHANGELOG.md`, `PROJECT_LOG.md`
- `scripts/` — `setup` / `dev` / `stop` (implementação)
- Raiz — atalhos `dev.cmd` / `setup.cmd` / `stop.cmd` e `package.json` (`pnpm dev`, como `npm run dev`)

## Ambientes

- Backend `dev`: PostgreSQL local via `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (`DB_PASSWORD` obrigatória)
- Backend `smoke`: H2 em memória (boot sem Postgres) — padrão do `dev` local
- Backend `prod`: mesmo contrato de variáveis (ex.: Neon)
- Backend testes: perfil `test` com H2 em memória
- Subir monorepo: `dev` (ou `pnpm dev`); só API: `backend/mvnw.cmd spring-boot:run`
- Sem Docker no fluxo local

## O que não fazer nesta fundação

CI/CD completo, autenticação completa, deploy, design system definitivo, tabelas de negócio inventadas.
