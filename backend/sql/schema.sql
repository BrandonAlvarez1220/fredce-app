-- FredceApp — esquema MySQL
-- Compatible con hosting compartido (HostGator). InnoDB + utf8mb4 en todo.
--
-- NOTA DE ALCANCE: este esquema cubre el lado "técnico app móvil" del sistema
-- (consultar servicios/válvulas asignados, catálogo de etapas, subir fotos).
-- El alta de servicios/válvulas/asignaciones (rol Administrador) hoy vive
-- conceptualmente en el sistema web existente (.NET/SQL Server, sesión
-- "FredceSistema"). Aquí NO se define una tabla `administradores`: falta
-- decidir con esa sesión si el admin escribe directo en esta MySQL (vía este
-- mismo API) o si esta base se alimenta por sincronización desde SQL Server.
-- Ver memoria del proyecto: fredceapp-spec / fredcesistema-peer-session.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- servicios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servicios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  folio         VARCHAR(20)  NOT NULL,               -- ej. SERV-2026-0042
  nombre        VARCHAR(150) NOT NULL,
  fecha         DATE         NOT NULL,
  estatus       ENUM('pendiente','en_proceso','completo','cancelado')
                             NOT NULL DEFAULT 'pendiente',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_servicios_folio (folio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contador atómico para generar el folio SERV-<anio>-<consecutivo> desde el
-- API (evita depender de triggers, que no siempre son cómodos en shared hosting).
CREATE TABLE IF NOT EXISTS folio_counters (
  anio          SMALLINT UNSIGNED PRIMARY KEY,
  ultimo_numero INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- valvulas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS valvulas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  servicio_id   INT UNSIGNED NOT NULL,
  codigo        VARCHAR(100) NOT NULL,                -- nombre/código de válvula, catálogo cerrado, lo asigna el admin
  estatus       ENUM('pendiente','en_proceso','completo')
                             NOT NULL DEFAULT 'pendiente',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_valvulas_servicio
    FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE CASCADE,
  KEY idx_valvulas_servicio (servicio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- etapas — catálogo dinámico, editable desde la web, se sincroniza a la app
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etapas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  orden         INT          NOT NULL DEFAULT 0,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,      -- soft-disable: no se borra, fotos ya la referencian
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- tecnicos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tecnicos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  usuario       VARCHAR(100) NOT NULL,                -- login de la app
  password_hash VARCHAR(255) NOT NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tecnicos_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- un técnico puede tener más de un dispositivo (spec: "dispositivo(s)")
CREATE TABLE IF NOT EXISTS tecnico_dispositivos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tecnico_id        INT UNSIGNED NOT NULL,
  device_identifier VARCHAR(191) NOT NULL,            -- id estable del dispositivo (ej. installationId de Expo)
  device_name       VARCHAR(150) NULL,
  last_sync_at      DATETIME     NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dispositivos_tecnico
    FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_tecnico_device (tecnico_id, device_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- tokens de sesión emitidos al hacer login desde la app (bearer token simple,
-- sin JWT para no depender de librerías externas en shared hosting)
CREATE TABLE IF NOT EXISTS api_tokens (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tecnico_id    INT UNSIGNED NOT NULL,
  device_id     INT UNSIGNED NULL,
  token         CHAR(64)     NOT NULL,                -- random_bytes(32) en hex
  expires_at    DATETIME     NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_tecnico
    FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id) ON DELETE CASCADE,
  CONSTRAINT fk_tokens_dispositivo
    FOREIGN KEY (device_id) REFERENCES tecnico_dispositivos(id) ON DELETE SET NULL,
  UNIQUE KEY uq_tokens_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- servicio_tecnico — asignación N:M
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servicio_tecnico (
  servicio_id   INT UNSIGNED NOT NULL,
  tecnico_id    INT UNSIGNED NOT NULL,
  asignado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (servicio_id, tecnico_id),
  CONSTRAINT fk_st_servicio FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE CASCADE,
  CONSTRAINT fk_st_tecnico  FOREIGN KEY (tecnico_id)  REFERENCES tecnicos(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- fotos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fotos (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_uuid    CHAR(36)     NOT NULL,     -- generado en el dispositivo al capturar; hace idempotente el reintento de subida
  valvula_id     INT UNSIGNED NOT NULL,
  etapa_id       INT UNSIGNED NOT NULL,
  tecnico_id     INT UNSIGNED NOT NULL,     -- quién la tomó (auditoría; el reporte NO agrupa por esto)
  drive_file_id  VARCHAR(191) NULL,         -- NULL mientras Drive no esté conectado (ver DriveUploader stub)
  orden          INT          NULL,
  etiqueta_libre VARCHAR(255) NULL,
  fecha_captura  DATETIME     NOT NULL,     -- timestamp local del dispositivo al tomar la foto
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- cuándo llegó al servidor
  CONSTRAINT fk_fotos_valvula FOREIGN KEY (valvula_id) REFERENCES valvulas(id) ON DELETE CASCADE,
  CONSTRAINT fk_fotos_etapa   FOREIGN KEY (etapa_id)   REFERENCES etapas(id),
  CONSTRAINT fk_fotos_tecnico FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id),
  UNIQUE KEY uq_fotos_client_uuid (client_uuid),
  KEY idx_fotos_valvula_etapa (valvula_id, etapa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Seed mínimo para poder probar el API de inmediato
-- ---------------------------------------------------------------------
INSERT INTO etapas (nombre, orden) VALUES
  ('Recepción',      1),
  ('Desarmado',      2),
  ('Diagnóstico',    3),
  ('Reparación',     4),
  ('Prueba',         5),
  ('Armado final',   6),
  ('Entrega',        7)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- No se siembra un técnico de prueba aquí: el hash de password tiene que
-- salir de password_hash() en PHP (no hay PHP en esta máquina de desarrollo
-- para generarlo de forma confiable). Corre backend/sql/seed_demo_tecnico.php
-- una vez en el servidor real para crear el usuario "demo".
