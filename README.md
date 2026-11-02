# Nihil

Sistema interno de gestão para restaurante: estoque, compras, cardápio, vendas, financeiro, funcionários e folha.

Ainda está na **fundação técnica** (estrutura e apps rodando). Regras de negócio vêm depois. Detalhes: [`docs/PROJECT_BIBLE.md`](docs/PROJECT_BIBLE.md).

Diário e changelog: [`docs/PROJECT_LOG.md`](docs/PROJECT_LOG.md), [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

## Pré-requisitos (Windows)

Instale estes programas **manualmente** (este repositório não instala nada por conta própria):

| Ferramenta | Motivo |
|---|---|
| **JDK 21** | Backend Spring Boot |
| **Node.js 22 LTS** | Frontend Angular |
| **pnpm** (`npm install -g pnpm`) | Dependências do frontend |
| **PostgreSQL 16+** (serviço Windows) | Perfil `dev` (desenvolvimento real) |

PostgreSQL: crie um banco e um usuário locais (exemplo: database `nihil`, user `nihil`) e anote a senha. Não usamos Docker.

### Variáveis de ambiente (perfil `dev`)

**CMD**

```bat
set DB_URL=jdbc:postgresql://localhost:5432/nihil
set DB_USERNAME=nihil
set DB_PASSWORD=sua-senha
```

**PowerShell**

```powershell
$env:DB_URL = 'jdbc:postgresql://localhost:5432/nihil'
$env:DB_USERNAME = 'nihil'
$env:DB_PASSWORD = 'sua-senha'
```

Modelo em `backend/.env.example`. Não commite senhas.

## Setup (baixa dependências)

Na raiz do repositório (equivalente ao `npm install` de um app JS):

```bat
setup
```

ou `pnpm setup` / `npm run setup` / `scripts\setup.cmd`.

Baixa dependências Maven e roda `pnpm install`.

## Rodar

Sem PostgreSQL (perfil `smoke`, H2 em memória — só para validar boot):

```bat
dev
```

ou, no estilo Node: `pnpm dev` / `npm run dev` (o `package.json` da raiz só orquestra; a API sozinha seria `mvnw spring-boot:run` no `backend/`).

Atalhos na raiz: `dev.cmd`, `setup.cmd`, `stop.cmd` → `scripts\`.

Com PostgreSQL local (perfil `dev`):

**CMD**

```bat
set DB_URL=jdbc:postgresql://localhost:5432/nihil
set DB_USERNAME=nihil
set DB_PASSWORD=sua-senha
dev -ProfileName dev
```

**PowerShell**

```powershell
$env:DB_URL = 'jdbc:postgresql://localhost:5432/nihil'
$env:DB_USERNAME = 'nihil'
$env:DB_PASSWORD = 'sua-senha'
.\dev.cmd -ProfileName dev
```

| App | URL |
|---|---|
| Frontend | http://localhost:4200 |
| Backend health | http://localhost:8080/actuator/health |

O `dev` roda **no mesmo terminal** (sem janelas extras):

1. Banner Spring do backend (NIHIL, versão, Java, Spring Boot, perfil, porta).
2. Quando **os dois** respondem HTTP, as portas juntas com ● verde (frontend + backend).
3. Erros relevantes no terminal. **Ctrl+C** encerra backend e frontend (Job Object + `stop`).

Só a API: `cd backend` → `mvnw.cmd spring-boot:run` (padrão Spring Boot; sem Angular).

## Parar

No terminal do `dev`: **Ctrl+C**.

De outro terminal, encerra backend e frontend (libera as portas 8080 e 4200):

```bat
stop
```

ou `pnpm stop` / `scripts\stop.cmd`.

Se aparecer `Port 4200 is already in use`, rode o `stop` e depois o `dev` de novo.

## Perfis do backend

| Perfil | Banco | Uso |
|---|---|---|
| `smoke` | H2 memória | Subir API sem Postgres |
| `dev` | PostgreSQL local via env | Desenvolvimento |
| `test` | H2 memória | testes automatizados |
| `prod` | PostgreSQL (env obrigatório) | Hospedado depois (ex.: Neon) |

## Tecnologias

| Área | Tecnologia |
|---|---|
| Backend | Java 21, Spring Boot 4.1.2, Maven Wrapper |
| Spring | Web, Data JPA, Bean Validation, Security, Actuator |
| Banco | PostgreSQL (dev/prod), Flyway, H2 (smoke/test) |
| Hospedagem DB (futuro) | Neon |
| Testes backend | JUnit 5, Mockito |
| Frontend | Angular 22, TypeScript, RxJS, SCSS |
| Frontend tooling | pnpm, Vitest |
| Versionamento | Git, GitHub |

## Testes

**CMD**

```bat
cd backend
mvnw.cmd test

cd ..\frontend
pnpm test:ci
```

**PowerShell**

```powershell
cd backend
.\mvnw.cmd test

cd ..\frontend
pnpm test:ci
```

## Validar o ambiente

1. Setup: `setup`
2. Rodar: `dev`
3. http://localhost:8080/actuator/health → `"status":"UP"`
4. http://localhost:4200 → página inicial do Nihil
5. (Opcional) com Postgres: `dev -ProfileName dev`
