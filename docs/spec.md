# App de captura de servicio de válvulas — Spec técnico

## Contexto del negocio
Empresa de reparación/servicio de válvulas. Los técnicos van a campo (plantas sin internet) y toman fotos de las válvulas durante distintas etapas del proceso de reparación. Hoy las fotos llegan desordenadas a una carpeta en la nube y hay que buscarlas manualmente para armar el reporte. Objetivo: capturar las fotos ya organizadas por servicio → válvula → etapa, para que el reporte salga directo desde el sistema web existente.

## Stack definido
- **App móvil:** React Native con Expo (Android e iOS desde un solo código)
- **Distribución:** interna, sin tiendas. Android vía APK compartido directo. iOS pendiente (requiere cuenta de desarrollador Apple: Ad Hoc o Enterprise, se define después)
- **Backend:** PHP (API REST), compatible con hosting compartido HostGator
- **Base de datos:** MySQL en HostGator
- **Almacenamiento de fotos:** Google Drive (API gratuita en este volumen de uso), organizadas en carpetas automáticas por servicio/válvula. MySQL solo guarda el `drive_file_id` como referencia
- **Local/offline:** SQLite en el dispositivo (vía expo-sqlite)
- **Sistema web existente:** ~~ya en desarrollo (stack de Brandon: .NET/C#/SQL Server)~~ **CORRECCIÓN (2026-09-12):** no existe tal sistema. Se confirmó con la sesión `FredceSistema` que en realidad es `generador-facturas` (PHP 8.1 + React/Vite/TS + MySQL), un sistema aparte que solo genera OC/Cotizaciones para FREDCE VALVES & SERVICES — sin ninguna tabla ni concepto de servicios/válvulas/técnicos/etapas. Ese dominio no existe en ningún otro lado: **esta MySQL/PHP es la única fuente de verdad**, admin incluido. Ver "Estado de avance" abajo.

## Roles y permisos
- **Administrador (web):** da de alta servicios (folio autogenerado, ej. `SERV-2026-0042`), registra las válvulas de cada servicio, asigna técnicos, mantiene catálogo de etapas. Este panel admin se construye dentro del mismo backend PHP/MySQL de FredceApp (no hay sistema externo que lo cubra — ver corrección arriba)
- **Técnico (app móvil):** solo consulta servicios/válvulas ya asignados. No puede crear servicios ni válvulas ni escribir nombres libres — elimina el riesgo de traslape/duplicados

## Modelo de datos (borrador)
```
servicios
  id, folio (único, autogenerado), nombre, fecha, estatus

valvulas
  id, servicio_id (FK), nombre/código, estatus

etapas (catálogo dinámico, editable desde la web)
  id, nombre, orden

fotos
  id, valvula_id (FK), etapa_id (FK), drive_file_id,
  orden, fecha_captura, etiqueta_libre (opcional)

tecnicos
  id, nombre, dispositivo(s)

servicio_tecnico (relación N:M, para asignación)
  servicio_id, tecnico_id
```

## Flujo de trabajo (offline-first)
1. **En el hotel/oficina (con wifi):** el técnico sincroniza — descarga servicios/válvulas/catálogo de etapas asignados. Sube también fotos pendientes de días anteriores.
2. **En campo (sin señal, varios días seguidos):** selecciona servicio → válvula → etapa (chips de catálogo) → toma fotos en ráfaga, todas heredan la etiqueta de la etapa activa. Todo se guarda en SQLite local. No requiere red para nada de esto.
3. **De regreso con señal:** sincronización automática en segundo plano, con reintentos silenciosos. Sube fotos + metadata a la API PHP, que las sube a Drive y guarda referencias en MySQL.

## Catálogo de etapas — dinámico, no hardcodeado
Vive en MySQL, se sincroniza igual que servicios/válvulas (mismo mecanismo offline-first). Razón: evita tener que recompilar y redistribuir la app (Android APK + certificados iOS) cada vez que cambie una etapa del proceso.

## Reglas de negocio clave
- Multi-técnico en un mismo servicio: sin conflicto, cada foto tiene ID único independiente del dispositivo que la tomó
- El reporte agrupa por válvula/etapa, no por técnico ni dispositivo
- Un servicio no "vence" mientras dure el trabajo — no necesita refrescarse cada día, solo subir lo nuevo

## Pantallas ya boceteadas (técnico)
1. Inicio — lista de servicios asignados (folio, resumen, estatus, hora de última sincronización)
2. Detalle de servicio — lista de válvulas con estatus (pendiente/en proceso/completa) y conteo de fotos
3. Detalle de válvula — selector de etapa (chips) + cuadrícula de fotos tomadas + botón de cámara

## Arquitectura final confirmada (2026-09-12)
`generador-facturas` (sesión de Claude Code **FredceSistema**, PHP 8.1 + React/Vite/TS + MySQL) es **el sistema central de FREDCE**: una sola base de datos, un solo backend PHP. Absorbe el dominio completo de servicios/válvulas/técnicos/etapas/fotos diseñado en este documento. El `backend/` construido en esta sesión (FredceApp) queda **deprecado** — su schema y los contratos exactos de los 5 endpoints ya se le entregaron a esa sesión para integrarlos sin romper la app. FredceApp de aquí en adelante es **solo la app móvil Expo**, consumiendo la API de `generador-facturas`.

Decisión de auth acordada entre ambas sesiones: el técnico/app móvil sigue con bearer token opaco (tabla `api_tokens` + `tecnico_dispositivos`, pensado para sesiones de hasta 30 días sin señal); el JWT que ya existe en `generador-facturas` se queda para el login del admin web. Son dos actores distintos, no se duplica el mismo problema.

## Pendiente por definir
- Diseño de pantallas del lado administrador (ahora en el React de `generador-facturas`, no aquí)
- Autenticación backend ↔ Google Drive API (cuenta de servicio de la empresa) — **no implementada todavía en ningún lado**, solo diseñada (stub en el backend deprecado)
- Manejo de caso "servicio no encontrado en campo" (imprevisto no dado de alta a tiempo)
- Punto de contacto entre el dominio de servicios y el de OC/Cotizaciones (ej. que un servicio referencie una Cotización) — no se ha vuelto a plantear tras decidir la fusión; puede resolverse solo, al vivir ya en el mismo sistema
- Probar `mobile/` en un dispositivo/emulador real (cámara, permisos, UI) — todavía no se ha corrido en un dispositivo físico
- Reintentos automáticos en segundo plano de la subida de fotos (hoy es manual, con pull-to-refresh)

## Estado de avance
- 2026-09-12: primer corte de `backend/` — esquema MySQL completo (`backend/sql/schema.sql`) y API PHP sin dependencias con login de técnico, catálogo de etapas, servicios/válvulas asignados y subida de fotos (Drive stubbeado).
- 2026-09-12: coordinación con la sesión **FredceSistema** — se aclaró que NO es un sistema .NET, sino `generador-facturas` (PHP+React+MySQL, solo OC/Cotizaciones).
- 2026-09-12: **pivote confirmado por Brandon** — `generador-facturas` se vuelve el sistema central; se le entregó el schema, los 5 contratos de endpoints, el estado real (no implementado) de Drive, y se acordó el esquema de auth dual. `backend/` de esta sesión queda deprecado como referencia.
- 2026-09-12: **integración validada end-to-end** — se instaló MariaDB local, se cargó el `database/schema.sql` fusionado de `generador-facturas` y se probaron los 5 endpoints reales (login, etapas, servicios, válvula, subida de foto con idempotencia por `client_uuid`) contra MySQL de verdad. Contratos confirmados sin cambios, solo el prefijo `/api/tecnico/*`.
- 2026-09-12: **`mobile/` creado** — Expo SDK 57 + TypeScript + Expo Router, SQLite local (cache + cola de subida offline-first), cámara con guardado permanente antes de subir, login con token persistido, y las 3 pantallas de técnico funcionando contra los contratos ya validados. Apunta a `http://192.168.0.18:8000/api/tecnico` (LAN de pruebas de generador-facturas, ver `mobile/README.md`). Verificado con `tsc`, `expo-doctor` y `expo export`; **no probado aún en dispositivo/emulador real**.
