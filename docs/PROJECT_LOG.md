# Project log — Nihil

Diário técnico: progresso, problemas encontrados e próximos passos.
Atualizar **na preparação para commit** (ou quando o responsável pedir documentação), não a cada prompt intermediário.
Não substitui a Bíblia (`PROJECT_BIBLE.md`) nem o `CHANGELOG.md`.

---

## 2026-11-02 — UI Estoque + header (mock)

### Progresso

- Página `/estoque` com dados mock: KPIs, tabela filtrável, paginação (20), painel de detalhes e histórico.
- Modal “Registrar movimentação” em etapas (busca/seleção → cadastro rápido se item não existir → entrada/saída).
- Header: dropdowns de notificações e modo (placeholder de tema).
- Sem integração Neon/API neste commit — apenas frontend UI/UX.

### Próximos passos

1. Requisitos reais de estoque em `docs/requirements/`.
2. API de estoque no backend + troca do mock.
3. Tema claro/escuro de verdade e notificações reais.

---

## 2026-11-02 — Fundação (estado atual)

### Progresso

- Monorepo: `backend/`, `frontend/`, `docs/`, `scripts/`, atalhos na raiz (`dev` / `setup` / `stop`) + `package.json` de orquestração (`pnpm dev`).
- Backend Spring Boot 4.1.2 / Java 21; perfil `smoke` (H2) sobe; health `UP` em `:8080`.
- Frontend Angular 22 em `:4200`.
- Banner Spring (`banner.txt`) com dados reais (versão `0.0.1-SNAPSHOT`, Java, Boot, perfil, porta).
- `dev`: mesmo terminal; banner → ● frontend + ● backend juntos quando HTTP ok; Ctrl+C encerra a árvore (Job Object + `stop.ps1`).
- Builds/testes iniciais do backend e frontend ok (ver Bíblia §14.2).
- Docker fora do fluxo local.

### Como subir (resumo)

```bat
setup
dev
```

Parar: **Ctrl+C** no terminal do `dev`, ou `stop` em outro terminal.

### Problemas encontrados

| Problema | Causa / efeito | Resolução |
|---|---|---|
| Health cinza após `dev` | Backend não iniciava (JAVA_HOME / start silencioso) | `dev.ps1` resolve JDK 21; processo no mesmo terminal |
| PowerShell `$HOME` | `foreach ($home …)` | Variável `$jdkHome` |
| Prompt Angular `(y/N)` | Analytics CLI | `NG_CLI_ANALYTICS=false` + `~/.angular-config.json` |
| Processos órfãos após Ctrl+C | Filhos Java/Node sobreviviam | Job Object `KILL_ON_JOB_CLOSE` + `stop.ps1` agressivo |
| Ruído no terminal do `dev` | Maven/Spring INFO demais | Filtro no `dev.ps1` + banner; portas só quando prontas |

### Próximos passos

1. PostgreSQL local + perfil `dev` (`DB_*`).
2. Requisitos do primeiro módulo (provavelmente estoque) em `docs/requirements/`.
3. Depois: CI, autenticação, Neon/prod.

### Critério da próxima entrega

Backend sobe no perfil `dev` contra PostgreSQL real; baseline Flyway aplicada; requisitos do próximo módulo escritos.
