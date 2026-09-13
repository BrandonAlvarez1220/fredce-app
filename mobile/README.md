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
- Paleta de marca en `src/theme.ts`, **confirmada por Brandon**: negro `#0A0A0B` + naranja `#E85C1A`, tomados directamente de fredce.com (`getComputedStyle`). Sin azul en ningún lado de la UI (headers, chips, botones) — el Navy de una iteración anterior quedó descartado. Dos variantes del logo en `assets/`: `logo.png` (original, wordmark Navy, para fondo claro) y `logo-dark.png` (wordmark recoloreado a blanco con ImageMagick, para fondo oscuro — ver sección de logo abajo).

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
- **Probado por Brandon en un teléfono real, ronda 1** (2026-09-12): login y servicio de prueba visibles. Corregido: contraste de login, logo/paleta, tamaño de chips, botón de cámara tapado por la barra de Android.
- **Screenshots en `../testing/` (ronda 2)**: revelaron un bug real que Brandon no había señalado explícitamente — los chips de etapa (pantalla de válvula) se veían como bloques gigantes ocupando media pantalla. Causa: el `FlatList` horizontal de los chips solo tenía `contentContainerStyle`, sin `style` propio, así que heredaba `flexGrow` y se estiraba a ocupar todo el espacio vertical disponible del contenedor. Corregido con `style={{flexGrow:0, height:48}}` explícito.
- **Feedback de texto, ronda 2** (2026-09-13): logo con contraste perdido en login, teclado que "sube"/reacomoda mal el formulario al enfocar contraseña, falta de ojito para mostrar/ocultar contraseña. Los tres corregidos (ver abajo).
- **Feedback de texto, ronda 3** (2026-09-13, tras ver la ronda 2 ya corregida): la tarjeta blanca detrás del logo "se veía como jpg pegado, descuadraba"; el header de las pantallas seguía en Navy mientras el resto ya era naranja ("según yo no hay azul, queda raro"); y **la barra de Android seguía tapando el botón de tomar foto** pese al fix de la ronda 1. Los tres corregidos (ver abajo). **Pendiente volver a probar en dispositivo** — nada de esto se ha podido verificar visualmente en un simulador/dispositivo real desde esta sesión.

### Logo sobre fondo oscuro — de tarjeta blanca a recolor real

La tarjeta blanca (ronda 2) resolvía el contraste pero se veía como un parche ajeno al diseño. Fix real: se recoloreó el propio archivo con ImageMagick — el wordmark "FREDCE" y el ícono de la válvula (ambos Navy `#071A3A` en el original) pasan a blanco, dejando intacto el naranja de "VALVES & SERVICES" y el engrane:
```
magick logo.png -fuzz 30% -fill white -opaque "#071A3A" logo-dark.png
```
(el PNG usa alpha no premultiplicado — mismo RGB en píxeles opacos y semitransparentes — por eso el reemplazo por color, no por posición, respeta el anti-aliasing). Resultado en `assets/logo-dark.png`, usado directo en login sin ninguna tarjeta de por medio. El `logo.png` original se conserva por si algo necesita la versión para fondo claro.

### Sin azul en ningún lado

Se quitó `colors.navy` de toda la UI (header del Stack, chip activo en la pantalla de válvula, texto de folio/conteo de fotos) y se reemplazó por `colors.oscuro` (estructura: headers) o `colors.naranja` (único acento: selección activa, botones, texto destacado) según el caso — dos colores consistentes, no tres. `navy`/`gold` se dejan en `theme.ts` como alias legacy (mismo valor que `naranja`) para no romper nada que aún los importe, pero ya no se usan en pantallas nuevas.

### Botón de cámara tapado — segundo intento, esta vez sin matemática de insets

El primer fix (`useSafeAreaInsets` + `position:absolute` con `bottom: insets.bottom + 24`) seguía sin funcionar en el dispositivo real. En vez de seguir ajustando el cálculo a mano, se cambió el enfoque de raíz: la barra de controles ya no es un overlay absoluto sobre la cámara — ahora es un elemento normal en la columna (`flex`), debajo de la vista de cámara, dentro de un `<SafeAreaView edges={['top','bottom']}>`. Al estar en flujo normal (no `position:absolute`), es estructuralmente imposible que el sistema operativo la dibuje encima o la tape, sin importar qué valor exacto reporten los insets en ese dispositivo. También se quitó `presentation: 'fullScreenModal'` de esta ruta (algunos dispositivos Android no propagan bien los safe-area insets a pantallas modales) a favor de una pantalla normal con animación `slide_from_bottom`.

## Ronda 4 (2026-09-13)

Tres pedidos más de Brandon: "el salir no sirve", "el botón de tomar fotos sigue sin quedar, sustituirlo por un + típico", y "¿cómo sabemos o daríamos de alta cuando ya terminamos con una válvula?".

### "Salir" no hacía nada — bug real, no percepción

`logout()` sí limpiaba el token, pero nada navegaba a `/login` si ya estabas parado en `/servicios` o más adentro del stack — la pantalla se quedaba igual, como si el botón no respondiera. Se agregó `AuthGate` en `app/_layout.tsx`: un componente sin UI que observa `token` + la ruta actual (`useSegments`) y fuerza `router.replace('/login')` en cuanto el token desaparece, sin importar en qué pantalla se dispare el logout. Protege también contra un futuro caso de expiración de sesión, no solo el botón manual.

### Botón de cámara — de barra completa a FAB

Después de dos intentos con la barra ocupando todo el ancho (ronda 1: insets manuales; ronda 3: flujo normal en la propia pantalla de cámara) el botón de ENTRADA a la cámara (el que dice "Tomar foto" en la pantalla de la válvula, no el disparador dentro de la cámara) seguía reportándose mal. En vez de seguir iterando sobre el mismo diseño, se cambió el patrón: ahora es un FAB circular naranja con un ícono "+" (Ionicons), flotando en la esquina inferior derecha con 24px de margen, dentro de un `SafeAreaView`. Al no ir pegado al borde (margen + safe area combinados, no uno solo), es mucho más difícil que cualquier barra del sistema lo alcance a tapar. El disparador *dentro* de la pantalla de cámara (el círculo blanco) no cambió, sigue con el fix de la ronda 3.

### Marcar una válvula como terminada

No existía forma de cambiar el estatus de una válvula desde la app — nacía "pendiente" y se quedaba así para siempre en la UI aunque el técnico ya hubiera terminado. Se agregó un selector de 3 botones (Pendiente / En proceso / Completa) arriba de los chips de etapa, en `valvulas/[id].tsx`. El cambio es **optimista y offline-first**, mismo patrón que las fotos:

1. Se guarda de inmediato en SQLite (`actualizarEstatusValvulaLocal`, columna nueva `estatus_sync_pendiente`) — se ve reflejado al instante, haya o no señal.
2. `sincronizarEstatusValvulas` intenta confirmarlo con el servidor en cada sync (antes incluso que las fotos, para minimizar la ventana de la siguiente nota).
3. `guardarServicios` fue modificado para NO pisar un estatus todavía pendiente de confirmar cuando llega un sync de catálogo — sin esto, un cambio de estatus recién hecho podía perderse si el catálogo se refrescaba antes de que el cambio llegara al servidor.

**`PUT /api/tecnico/valvulas/{id}/estatus`** — ya implementado por FredceSistema y validado por mí directo contra el servidor LAN real (`tecnico1`, cambio válido, 422 en estatus fuera del ENUM, 404 en válvula no asignada, 401 sin token — todo correcto). El cliente de la app ya apunta ahí, no requiere ningún cambio adicional.

## Ronda 5 (2026-09-13, screenshot `../testing/3.jpeg`)

Feedback tras ver la ronda 4 ya corregida: "el FAB debería estar un poco más arriba" y, sobre el selector de estatus, "no me termina de convencer, se ve muy simple, muy modificable" (parafraseado — costó ponerlo en palabras, lo cual es una señal en sí misma de que le faltaba peso visual).

- **FAB un poco más arriba**: se subió de `bottom:24` a `bottom:40`. Nota aparte, no un cambio de código: en el screenshot se ve una barra de 3 íconos (☰ ⭕ ‹) pegada hasta abajo y un círculo con engrane flotando cerca del header — ninguno de los dos es parte de la UI de esta app (no hay ningún ícono de engrane en ningún archivo). Todo apunta a que son los controles flotantes de la app/herramienta usada para grabar la pantalla, no la barra de navegación real de Android. Si es así, ningún ajuste de `SafeAreaView`/insets del lado de la app puede "arreglarlo" porque no es parte del sistema operativo — vale la pena confirmar probando sin grabar pantalla (captura con el botón físico de encendido+volumen) antes de seguir ajustando este punto a ciegas.
- **Selector de estatus "muy simple/modificable"**: se rediseñó de 3 botones sueltos a un control segmentado dentro de una tarjeta propia (sombra, borde, radio de esquina), con una etiqueta "ESTATUS DE LA VÁLVULA" arriba para darle contexto, e íconos por opción (reloj/herramienta/palomita, `@expo/vector-icons`) en vez de solo texto. También se agregó **confirmación** (`Alert.alert`) específicamente al marcar "Completa" — es la acción más definitiva (cierra el trabajo en esa válvula), así que ya no se puede activar con un solo toque accidental como las otras dos; "Pendiente"/"En proceso" siguen siendo de un toque, por ser estados de trabajo normales y reversibles.

## Borrar una foto (2026-09-13)

Brandon preguntó "¿y si tomo una mala foto, de borrarla ni hablar, verdad?" — no había forma, hueco real. Se agregó un botón "✕" en la esquina de cada miniatura (pantalla de válvula), con confirmación (`Alert`). El comportamiento depende de si la foto ya se había subido:

- **Nunca subida** (`sync_status` en `pendiente`/`error`): se borra de una vez, local — fila de SQLite + archivo físico (`File.delete()`), sin tocar el servidor.
- **Ya subida** (`sync_status='subida'`): se oculta de la cuadrícula al instante (nuevo estado `sync_status='eliminar_pendiente'`, filtrado en la UI) y `sincronizarEliminacionesFotos` confirma el borrado con el servidor en el siguiente sync — mismo patrón optimista/offline-first que ya usan las fotos y el estatus de válvula.

**`DELETE /api/tecnico/fotos/{id}`** — ya implementado por FredceSistema y validado por mí contra el servidor real (crear foto → borrar → 200 → confirmar que ya no aparece en `GET /valvulas/{id}` → segundo DELETE → 404). Sin cambios necesarios del lado de la app.

## Bug real encontrado por FredceSistema: fotos fallando por límite de tamaño de PHP (2026-09-13)

Revisando el log del servidor (no algo que yo hubiera reportado), FredceSistema encontró **70 subidas de foto fallidas con 500** antes de que nadie se diera cuenta — causa: `upload_max_filesize` de PHP por defecto es 2M, y una foto de celular real fácil pesa más. Ya lo subieron en el servidor. De mi lado, para atacar la causa (no solo el síntoma) y porque es exactamente el escenario de señal débil que le importa a esta app, se agregó **compresión real antes de subir** (`app/valvulas/[id]/camara.tsx`):

- `expo-image-manipulator` reduce cada foto a máx. 1600px de lado mayor + 75% de calidad JPEG, sin importar cuántos megapixeles tenga la cámara del teléfono (antes: sin resize, solo `quality:0.7` de captura — con cámaras modernas eso todavía puede dar varios MB).
- Esto no reemplaza el fix del límite del servidor (esa foto igual necesita llegar), pero hace que llegue mucho más rápido y con menos probabilidad de fallar por timeout en campo.
- También se subió el timeout específico de subida de foto (`UPLOAD_TIMEOUT_MS`) de 15s (compartido con las llamadas JSON livianas) a 45s — una foto, aun comprimida, sigue siendo el request más pesado de la app.
- Se agregó poder tocar el badge "Error" de una foto para ver el mensaje real (antes solo decía "Error" sin más detalle) — para que un caso como las 70 fallas silenciosas sea visible desde la propia app la próxima vez, no solo desde el log del servidor.

**No verificado en dispositivo real** — la API de `expo-image-manipulator` se implementó siguiendo la documentación exacta de esta versión del SDK (el flujo cambió respecto a versiones anteriores), pero no hay forma de confirmar visualmente el resultado ni medir el tamaño final real de una foto de cámara real desde esta sesión.

## 🐛 BUG CONOCIDO, sin corregir — SQLSTATE[22007] en `fecha_captura` (2026-09-13)

Brandon reportó el error al probar la subida de fotos desde el teléfono. **Causa casi segura, sin corregir todavía** (se deja documentado para retomar mañana, no se tocó código):

- `app/valvulas/[id]/camara.tsx` línea ~93 genera la fecha de captura con `new Date().toISOString()`, que produce algo como `"2026-09-13T20:15:30.123Z"` (formato ISO 8601, con `T`, milisegundos y `Z`).
- Ese string viaja intacto: `encolarFoto` → SQLite (ahí no truena, es columna `TEXT`) → `sincronizarFotosPendientes` → `subirFoto` (`src/api/client.ts`) → campo `fecha_captura` del `multipart/form-data` → PHP lo inserta tal cual en la columna `DATETIME` de MySQL.
- MySQL **no acepta** el formato ISO 8601 completo en una columna `DATETIME` (espera `YYYY-MM-DD HH:MM:SS`, sin `T`/milisegundos/`Z`) → de ahí el `SQLSTATE[22007]: Invalid datetime format`.

**Fix propuesto para mañana** (no aplicado): convertir a formato MySQL justo antes de mandarlo por la red, en `subirFoto()` (`src/api/client.ts`), sin tocar cómo se guarda localmente (SQLite no tiene problema con ISO 8601, y es cómodo para `new Date(...)` en JS):

```ts
function aFechaMysql(iso: string): string {
  return iso.slice(0, 19).replace('T', ' '); // "2026-09-13T20:15:30.123Z" -> "2026-09-13 20:15:30"
}
// y en subirFoto():
form.append('fecha_captura', aFechaMysql(params.fechaCaptura));
```

Un cambio de una línea, bajo riesgo. Probablemente vale la pena que FredceSistema también valide/normalice la fecha del lado del PHP como defensa adicional (por si algún día llega otro cliente con otro formato), pero el fix real es este del lado de la app, que es quien genera el string mal formado.

## Pendiente

- **Corregir el bug de `fecha_captura` de arriba** — bloquea que cualquier foto se suba de verdad hoy mismo, es lo primero de mañana.
- Volver a probar en dispositivo real TODOS los ajustes de UI (rondas 1 a 5) y los flujos de estatus/borrado/compresión de foto — nada se ha podido confirmar visualmente desde esta sesión, solo por bundle/tsc limpios, razonamiento de layout/contraste, y pruebas de API por curl (no a través de la UI real).
- Manejo de caso "servicio no encontrado en campo" (aún no resuelto en el spec).
- Reemplazar el ícono de la app (hoy es el genérico de Expo) por uno basado en el logo de marca — el `logo-dark.png` nuevo tampoco sirve directo como adaptive icon (es rectangular, 2823×1053); requiere recortar solo el ícono de la válvula a un cuadrado.
- Pantalla de detalle de servicio no distingue todavía qué técnico tomó qué foto (a propósito, el spec dice que el reporte no agrupa por técnico) pero podría valer la pena mostrarlo como metadato secundario.
