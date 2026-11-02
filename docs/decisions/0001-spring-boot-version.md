# ADR 0001 — Spring Boot version

- Status: Accepted
- Date: 2026-11-02

## Context

The initial request asked for Spring Boot 3.x. As of this foundation date, Spring Boot 3.5 has reached open-source end of life (2026-06-30). The current stable line is Spring Boot 4.1.x (4.1.2).

## Decision

Use **Spring Boot 4.1.2** with **Java 21 LTS**.

## Consequences

- New projects stay on a supported release line.
- Starter artifact names follow Boot 4 conventions (for example `spring-boot-starter-webmvc`).
- Documentation and examples must follow Boot 4 / Spring Framework 7 APIs.
