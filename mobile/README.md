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
- **@react-native-community/netinfo** para disparar sync automático al recuperar señal.
- Sin Redux/Zustand: `AuthContext` + `SyncContext` + hooks de `expo-sqlite` (`useSQLiteContext`) alcanzan para este alcance.
- Paleta de marca compartida con `generador-facturas` en `src/theme.ts` (Navy `#1B2A4A` / Gold `#F5A820`), mismo logo (`assets/logo.png`, copiado de `generador-facturas/logo_transparente.png`).

## Estructura

```
app/
  _layout.tsx            Stack raíz + SQLiteProvider + AuthProvider + SyncProvider
  index.tsx              redirige a /login o /servicios según sesión
  login.tsx
  servicios/index.tsx     Pantalla 1: servicios asignados + barra de sync
  servicios/[id].tsx      Pantalla 2: válvulas del servicio
  valvulas/[id].tsx       Pantalla 3: chips de etapa + grid de fotos + botón cámara
  valvulas/[id]/camara.tsx  modal de captura (ráfaga)
src/
  api/        cliente HTTP + tipos, contratos ya validados contra el backend real
  auth/       AuthContext (token/tecnico en SecureStore) + id de dispositivo
  db/         schema.ts (migración SQLite) + repository.ts (CRUD local)
  sync/       sync.ts (llamadas a la API) + SyncContext.tsx (cuándo y cómo se dispara, ver abajo)
  config.ts   URL base de la API (app.json → expo.extra.apiBaseUrl)
  theme.ts    paleta de marca
```

## Cuándo y cómo se sincronizan las fotos (respuesta a la pregunta de Brandon)

Tres capas, para que nunca dependa de que alguien se acuerde de un botón:

1. **Automático al recuperar señal** — `SyncContext` escucha `NetInfo`; en cuanto el teléfono pasa de sin-señal a con-señal, dispara la subida de la cola pendiente sola, en silencio.
2. **Automático al volver a primer plano** — igual, mediante `AppState`: si el técnico abre la app ya con WiFi (p.ej. de vuelta en el hotel), se sincroniza sin acción explícita. También se intenta justo después de cada foto capturada (sin bloquear la ráfaga).
3. **Manual, por si acaso** — botón "Sincronizar ahora" visible en Inicio (además del pull-to-refresh de siempre), para forzarlo antes de perder el WiFi o para tranquilidad del técnico.

**Visible en todo momento:**
- Inicio muestra "📤 N fotos por subir" o "✓ Todo subido", más la hora de la última sincronización.
- Cada miniatura en la cuadrícula de la válvula trae su propio badge "Pendiente" (amarillo) o "Error" (rojo) según `sync_status` en SQLite — así se ve foto por foto, no solo en global.
- Los errores de sync (típicamente "sin señal") no interrumpen nada — se guardan en `sync_status='error'` y se reintentan solos en el siguiente disparo automático.

## Flujo offline-first (resto)

1. **Login** guarda token+técnico en SecureStore (expira según `expires_in` del servidor, hoy 30 días).
2. **Captura de fotos** en `valvulas/[id]/camara.tsx` no depende de la red en absoluto: guarda el archivo en `Paths.document/fredceapp_fotos/` y encola la fila en SQLite con `sync_status='pendiente'`, con un `client_uuid` generado en el momento — eso hace **idempotente** el reintento de subida (ver `backend`/`generador-facturas`: mismo `client_uuid` nunca duplica).
3. `sincronizarCatalogos` baja servicios/válvulas/etapas y siempre corre después de subir lo pendiente, para no pisar cambios locales con una foto todavía sin subir.

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
- `npx expo export --platform android` — bundlea sin errores de resolución de imports/rutas.
- Login/etapas/servicios/válvulas/subida de fotos probados de punta a punta contra el backend real (ver memoria del proyecto / `docs/spec.md`).
- **Probado por Brandon en un teléfono real** (2026-09-12): login y servicio de prueba visibles. Feedback de esa prueba ya corregido en este commit: contraste de la pantalla de login, logo/paleta de marca, tamaño de los chips de etapa, y el botón de cámara tapado por la barra de navegación de Android (faltaba `useSafeAreaInsets`). **Pendiente volver a probar en dispositivo** para confirmar que los 4 ajustes se ven bien en la práctica.

## Pendiente

- Volver a probar en dispositivo real los ajustes de UI de este commit (contraste, tamaños, safe-area de la cámara).
- Manejo de caso "servicio no encontrado en campo" (aún no resuelto en el spec).
- Reemplazar el ícono de la app (hoy es el genérico de Expo) por uno basado en el logo de marca — no se hizo en este commit porque el logo compartido es rectangular (2823×1053) y no un ícono cuadrado listo para adaptive icon; requiere recortarlo/adaptarlo primero.
- Pantalla de detalle de servicio no distingue todavía qué técnico tomó qué foto (a propósito, el spec dice que el reporte no agrupa por técnico) pero podría valer la pena mostrarlo como metadato secundario.
