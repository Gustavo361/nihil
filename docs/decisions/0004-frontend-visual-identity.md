# ADR 0004 — Frontend visual identity (initial)

- Status: Accepted
- Date: 2026-11-02

## Context

The project Bible stated that the visual library and design system were not yet defined. The product owner approved an initial identity based on a reference dashboard (sidebar + cards aesthetic), adapted for daily restaurant ERP use (no floating purple shell).

## Decision

Adopt the following as the **initial** Nihil frontend visual standard:

| Token | Value |
|---|---|
| Primary purple | `#6729F2` |
| Secondary purple | `#9747FF` |
| Primary text | `#302D50` |
| Secondary text | `#85858E` |
| Sidebar background | `#FFFFFF` |
| App surface | `#ECF2F9` |
| Typography | Plus Jakarta Sans |
| Spacing scale | 8 / 16 / 24 / 32 px |
| Border radii | 12 / 16 / 28 / 40 px |

Layout: fixed white sidebar + light main area. Purple→violet gradient is reserved for the **active navigation item** only.

Icons: **Tabler Icons** via `@tabler/icons-angular`.

Charts: **Apache ECharts** is planned for dashboard/financial reports later; not installed in this foundation step.

## Consequences

- CSS custom properties in `frontend/src/styles.scss` are the source of truth for tokens.
- New screens should reuse these tokens instead of inventing parallel palettes.
- Future design-system refinements should update this ADR (or supersede it) rather than silently drifting.
