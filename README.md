# FredceApp

App de captura de fotos de servicio de válvulas (técnicos en campo, offline-first)
+ backend PHP/MySQL + almacenamiento en Google Drive.

Spec completo: [`docs/spec.md`](docs/spec.md).

## Estructura

- `backend/` — API REST en PHP + esquema MySQL (ver `backend/README.md`). **Empezado.**
- `mobile/` — app React Native/Expo para técnicos. **Pendiente.**

## Relación con otros proyectos

**Corrección (2026-09-12):** no existe un sistema .NET externo para este dominio.
La sesión hermana de Claude Code **FredceSistema** es en realidad
`generador-facturas` (PHP + React/Vite/TS + MySQL), un sistema aparte que solo
genera OC/Cotizaciones para FREDCE VALVES & SERVICES — sin tablas ni overlap
con servicios/válvulas/técnicos/etapas. Esta base MySQL/PHP es la **única
fuente de verdad** para ese dominio; el panel de administrador se construye
aquí mismo, sin capa de sincronización externa. Detalle completo en
`docs/spec.md` → "Estado de avance".
