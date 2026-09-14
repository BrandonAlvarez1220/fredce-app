# Guía: generar el APK instalable

Esta guía es para cuando ya estén listos para distribuir un APK real a los
técnicos — **no antes de mover el backend a producción y actualizar la URL**
(ver el checklist abajo). Hasta ese momento, seguir probando con Expo Go
(`npm start` + QR) es lo correcto: es más rápido para iterar y no gasta
minutos de build.

## Por qué no es lo mismo que "npm start"

Expo Go (la app que usas para escanear el QR) es un contenedor genérico que
ya trae compilado un montón de módulos nativos comunes — sirve para
desarrollar rápido, pero **no es la app real** y no se puede repartir como
tal. Un APK real es un build standalone: compila esta app específica,
con su ícono, su nombre, su `package` propio, y todos los módulos nativos
que usa (`expo-camera`, `expo-sqlite`, `expo-secure-store`) ya integrados —
eso es lo que EAS Build genera.

## Checklist antes de generar el APK "de verdad"

- [ ] Backend (`generador-facturas`) ya corriendo en producción (HostGator o
      donde quede), no en la LAN de pruebas.
- [ ] `app.json` → `expo.extra.apiBaseUrl` actualizado a esa URL real (hoy
      apunta a una IP de LAN, ver README principal — solo funciona en la
      misma red que esa PC).
- [ ] Confirmar que el rename OneDrive/`onedrive_file_id` (2026-09-13) ya
      quedó reflejado en lo que sea que esté corriendo en producción.
- [ ] Ícono/nombre de la app (`app.json` → `name`, `assets/icon.png`) tal
      como quieren que se vea en el teléfono — esto también queda "fijo"
      una vez que empiecen a compartir el APK.

Ninguno de estos pasos lo puede hacer este asistente por ti sin que se lo
pidas explícitamente (mover el backend a HostGator, sobre todo, es una
acción que toca coordinar con FredceSistema).

## Paso a paso

### 1. Cuenta y CLI de EAS (una sola vez)

```
npm install -g eas-cli
eas login
```

Pide una cuenta de Expo (gratis) — si no tienes una, `eas login` te da la
opción de crearla ahí mismo.

### 2. Generar el build

Desde `mobile/`:

```
eas build -p android --profile preview
```

El perfil `preview` ya está configurado en `eas.json` (ver abajo por qué
importa). Este comando sube el proyecto a la nube de Expo, hace la
compilación ahí (no necesitas Android Studio ni SDK de Android instalado
localmente) y muestra una barra de progreso con el link al dashboard.

Tiempo típico en la cola gratis: **10-20 minutos**. Se puede cerrar la
terminal y revisar después en el link que da el comando, o con:

```
eas build:list
```

### 3. Descargar e instalar

Al terminar, la terminal (y el dashboard) dan un link + código QR. Abrir
ese link **desde el navegador del propio teléfono Android** (o escanear el
QR) descarga el `.apk` directo. Android va a pedir permiso la primera vez
para "instalar apps de origen desconocido" (u "orígenes no confiables",
según la versión) — hay que aceptarlo, es normal para un APK que no viene
de Play Store.

### 4. Repartirlo a los técnicos

El mismo link de descarga sirve para cualquiera con el archivo — se puede
mandar por WhatsApp, o subir el `.apk` descargado a donde sea más cómodo
compartirlo. Cada técnico repite el paso 3 en su propio teléfono.

## Por qué `eas.json` tiene el perfil `preview` así

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

Sin esto, el build de EAS genera por default un `.aab` (Android App
Bundle) — el formato que pide Google Play Store, pero que **no se puede
instalar directo en un teléfono**. `buildType: apk` fuerza el formato
correcto para repartir por fuera de la tienda.

## Actualizar la app después (nueva versión)

Cuando haya cambios de código que los técnicos ya tengan instalado deban
recibir, sube `version` en `app.json` (ej. `1.0.0` → `1.0.1`) y repite el
paso 2 — no hay actualización automática tipo OTA configurada todavía
(existe `expo-updates` para eso, pero es un tema aparte si algún día
importa evitar reinstalar el APK a mano en cada teléfono).

## Problemas comunes

- **"missing android.package"**: ya está configurado (`com.fredce.tecnico`
  en `app.json`), no debería salir. Si sale, es que algo lo borró de
  `app.json`.
- **El build falla en la nube por un plugin nativo**: revisar el log que da
  el propio dashboard de EAS — casi siempre apunta justo a qué paquete de
  `app.json` → `plugins` está mal configurado.
- **El APK instala pero no conecta al backend**: casi siempre es
  `apiBaseUrl` en `app.json` apuntando todavía a la IP de LAN de pruebas —
  ver el checklist arriba.
