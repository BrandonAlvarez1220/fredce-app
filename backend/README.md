# FredceApp — backend

API REST en PHP puro (sin Composer/framework) + MySQL, pensado para correr
tal cual en hosting compartido (HostGator). Ver el spec completo en
`../docs/spec.md`.

## Estructura

```
backend/
  public/          <- document root del hosting apunta aquí
    index.php      <- front controller / router
    .htaccess      <- reescribe todo a index.php
  src/
    Controllers/    AuthController, SyncController, FotoController
    Auth.php        tokens bearer (login/verificación)
    Database.php    conexión PDO (singleton)
    DriveUploader.php  stub de subida a Google Drive (ver TODO adentro)
    Env.php         carga manual de .env
    Response.php    helper de respuestas JSON
    Router.php      router mínimo con parámetros {id}
  sql/
    schema.sql              crea todas las tablas + catálogo de etapas
    seed_demo_tecnico.php   crea técnico/servicio/válvula de prueba (correr en el servidor, con PHP real)
  .env.example
```

## Poner en marcha (en el hosting o localmente con PHP+MySQL)

1. Crear la base de datos MySQL y correr `sql/schema.sql`.
2. Copiar `.env.example` a `.env` y llenar credenciales de MySQL.
3. Correr `php sql/seed_demo_tecnico.php` una vez (crea usuario `demo` / `demo1234`, un servicio y una válvula de prueba).
4. Apuntar el document root del hosting a `backend/public/`.
5. Probar:
   ```
   curl -X POST https://tu-dominio/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"usuario":"demo","password":"demo1234","device_identifier":"dev-1"}'
   ```
   Con el token que regresa:
   ```
   curl https://tu-dominio/api/servicios -H "Authorization: Bearer <token>"
   curl https://tu-dominio/api/etapas -H "Authorization: Bearer <token>"
   ```

## Endpoints implementados

| Método | Ruta                | Auth | Descripción |
|--------|---------------------|------|-------------|
| POST   | /api/auth/login     | no   | login de técnico, regresa token bearer |
| GET    | /api/etapas         | sí   | catálogo de etapas activo, ordenado |
| GET    | /api/servicios      | sí   | servicios asignados al técnico + válvulas + conteo de fotos |
| GET    | /api/valvulas/{id}  | sí   | detalle de válvula + fotos (para la pantalla de cámara/grid) |
| POST   | /api/fotos          | sí   | sube una foto (multipart), idempotente por `client_uuid` |

## Pendiente (ver `docs/spec.md` → "Pendiente por definir")

- Subida real a Google Drive (`DriveUploader::upload`, hoy es un stub controlado por `DRIVE_ENABLED`).
- Endpoints de administrador (alta de servicios/válvulas/asignaciones/etapas) — **ya desbloqueado**: se confirmó que no hay sistema externo (`FredceSistema` es `generador-facturas`, un sistema de OC/Cotizaciones sin overlap de dominio), así que esta MySQL/PHP es la única fuente de verdad y el admin se construye directo aquí.
- Caso "servicio no encontrado en campo".
