# Architecture overview — Nihil

## Style

Modular monolith. One deployable Spring Boot backend and one Angular SPA. Business areas are packages inside the same application, not separate services.

## Backend packages

| Package | Responsibility |
|---|---|
| `identity` | Users, authentication, authorization |
| `inventory` | Stock items, units, movements |
| `purchasing` | Suppliers, purchases, goods receipt |
| `menu` | Dishes, recipes, estimated costs |
| `sales` | Internal sales registration |
| `finance` | Cash flow, payables/receivables, reports |
| `employees` | Staff and schedules |
| `payroll` | Payroll (after validated rules) |
| `shared` | Truly shared helpers only |
| `config` | Cross-cutting Spring configuration |

Pragmatic layering when a use case appears: HTTP controller → application service → persistence. No premature interfaces or DDD ceremony.

## Frontend

Angular feature folders under `src/app/features/`, shared UI/utilities under `src/app/shared/`, and central HTTP/API helpers under `src/app/core/`.

## Data

- PostgreSQL is the system of record.
- Local PostgreSQL for development; Neon planned for hosted environments.
- Flyway owns schema changes. No business tables in the foundation baseline.
- Monetary values use `NUMERIC`/`DECIMAL` in SQL and `BigDecimal` in Java.

## Security (foundation)

Spring Security is on the classpath with a minimal filter chain: actuator health/info are public; everything else requires authentication. Full authn/authz belongs to the identity module later.

## Local run (Windows)

- Monorepo from repo root: `dev` (or `pnpm dev`) — backend smoke + Angular; same terminal; Ctrl+C stops both.
- API only (Spring Boot usual): `backend/mvnw.cmd spring-boot:run`.
