# FredceApp

App de captura de fotos de servicio de válvulas (técnicos en campo, offline-first),
consumiendo el backend central de FREDCE.

Spec completo: [`docs/spec.md`](docs/spec.md).

## Estructura

- `mobile/` — app React Native/Expo para técnicos. **En construcción.** Consume la API de `generador-facturas`.
- `backend/` — API REST en PHP + esquema MySQL construida en esta sesión. **Deprecado** (ver `backend/README.md`): su schema y contratos de endpoints ya se integraron a `generador-facturas`, que ahora es el backend central. Se conserva solo como referencia histórica.

## Relación con otros proyectos

**Decisión confirmada por Brandon (2026-09-12):** todo FREDCE se centraliza en
`generador-facturas` (sesión de Claude Code **FredceSistema**, stack PHP +
React/Vite/TS + MySQL) — una sola base de datos, un solo backend. Absorbe el
dominio de servicios/válvulas/técnicos/etapas/fotos que se diseñó originalmente
aquí. Esta sesión (FredceApp) se enfoca de ahora en adelante solo en la app
móvil Expo. Detalle completo y contratos ya entregados en
`docs/spec.md` → "Estado de avance".
