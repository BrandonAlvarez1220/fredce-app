# FredceApp — app de técnico (Expo)

App React Native/Expo para los técnicos en campo. Consume la API de
`generador-facturas` bajo `/api/tecnico/*` (ver `../docs/spec.md` para el
contexto completo de la arquitectura y `../backend/` para el backend
original, ahora deprecado/fusionado ahí).

## Stack

- Expo SDK 57 + TypeScript, **Expo Router** (rutas por archivo en `app/`).
- **expo-sqlite** para cache local + cola de subida de fotos (offline-first).
- **expo-camera** para captura, **expo-file-system** (API `File`/`Directory`) para guardar la foto de forma permanente antes de subirla.
- **expo-secure-store** para el token de sesión del técnico.
- Sin Redux/Zustand: un `AuthContext` + hooks de `expo-sqlite` (`useSQLiteContext`) alcanzan para este alcance.

## Estructura

```
app/
  _layout.tsx            Stack raíz + SQLiteProvider + AuthProvider
  index.tsx              redirige a /login o /servicios según sesión
  login.tsx
  servicios/index.tsx     Pantalla 1: servicios asignados
  servicios/[id].tsx      Pantalla 2: válvulas del servicio
  valvulas/[id].tsx       Pantalla 3: chips de etapa + grid de fotos + botón cámara
  valvulas/[id]/camara.tsx  modal de captura (ráfaga)
src/
  api/        cliente HTTP + tipos, contratos ya validados contra el backend real
  auth/       AuthContext (token/tecnico en SecureStore) + id de dispositivo
  db/         schema.ts (migración SQLite) + repository.ts (CRUD local)
  sync/       sincronizarCatalogos (baja servicios/etapas) y sincronizarFotosPendientes (sube la cola)
  config.ts   URL base de la API (app.json → expo.extra.apiBaseUrl)
```

## Flujo offline-first implementado

1. **Login** guarda token+técnico en SecureStore (expira según `expires_in` del servidor, hoy 30 días).
2. **Pull-to-refresh en Inicio** llama `sincronizarFotosPendientes` (sube lo pendiente primero) y luego `sincronizarCatalogos` (baja servicios/válvulas/etapas), todo contra SQLite local — la UI siempre lee de SQLite, nunca directo de la red.
3. **Captura de fotos** en `valvulas/[id]/camara.tsx` no depende de la red en absoluto: guarda el archivo en `Paths.document/fredceapp_fotos/` y encola la fila en SQLite con `sync_status='pendiente'`, con un `client_uuid` generado en el momento — eso hace **idempotente** el reintento de subida (ver `backend`/`generador-facturas`: mismo `client_uuid` nunca duplica).
4. Los badges "Pendiente"/"Error" en la cuadrícula reflejan `sync_status` de cada foto en SQLite.

## Configurar la URL de la API

`app.json` → `expo.extra.apiBaseUrl`. Hoy apunta a la LAN de pruebas de `generador-facturas`:
```
http://192.168.0.18:8000/api/tecnico
```
Solo válido mientras esa PC esté prendida y el dispositivo esté en la misma red WiFi. Cuando se mude a HostGator, cambiar solo este valor.

## Correr en desarrollo

```
cd mobile
npm install
npm start        # abre Metro; escanea el QR con Expo Go, o npm run android
```

Requiere estar en la misma red que el backend LAN mencionado arriba (o cambiar `apiBaseUrl` a `http://localhost:8000/api/tecnico` si el backend corre en la misma máquina que el emulador).

## Verificado en esta sesión (sin dispositivo físico a mano)

- `npx tsc --noEmit` — sin errores de tipos.
- `npx expo-doctor` — 21/21 checks.
- `npx expo export --platform android` — bundlea los 1313 módulos sin errores de resolución de imports/rutas.
- **No probado en un dispositivo/emulador real** (cámara, captura, permisos, UI). Login/etapas/servicios/válvulas/subida de fotos sí están probados de punta a punta contra el backend real (ver memoria del proyecto / `docs/spec.md`) — lo que falta validar es específicamente la capa de UI/cámara de esta app.

## Pendiente

- Probar en un dispositivo/emulador real (permisos de cámara, UI, flujo de captura).
- Manejo de caso "servicio no encontrado en campo" (aún no resuelto en el spec).
- Reintentos automáticos en segundo plano (hoy la subida de pendientes solo se dispara manualmente con pull-to-refresh en Inicio, no hay tarea en background).
- Pantalla de detalle de servicio no distingue todavía qué técnico tomó qué foto (a propósito, el spec dice que el reporte no agrupa por técnico) pero podría valer la pena mostrarlo como metadato secundario.
