# FredceApp

App de captura de fotos de servicio de válvulas (técnicos en campo, offline-first)
+ backend PHP/MySQL + almacenamiento en Google Drive.

Spec completo: [`docs/spec.md`](docs/spec.md).

## Estructura

- `backend/` — API REST en PHP + esquema MySQL (ver `backend/README.md`). **Empezado.**
- `mobile/` — app React Native/Expo para técnicos. **Pendiente.**

## Relación con otros proyectos

El sistema web de administración (alta de servicios/válvulas, asignación de
técnicos, catálogo de etapas) es un stack aparte (.NET/C#/SQL Server), llevado
en la sesión de Claude Code **FredceSistema**. Antes de construir el panel de
administrador aquí hay que acordar con esa sesión si escribe directo a esta
MySQL o si esta base se alimenta por sincronización.
