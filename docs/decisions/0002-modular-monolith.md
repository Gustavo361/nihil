# ADR 0002 — Modular monolith

- Status: Accepted
- Date: 2026-11-02

## Context

The restaurant system needs several business areas (stock, sales, finance, payroll, etc.) but is early-stage and operated by a small team.

## Decision

Ship a modular monolith: one Spring Boot app with domain packages, one Angular SPA, one PostgreSQL database.

## Consequences

- Simpler local development, transactions, and deployment.
- Module boundaries must still be respected as the codebase grows.
- Microsservices remain out of scope until operational need is proven.
