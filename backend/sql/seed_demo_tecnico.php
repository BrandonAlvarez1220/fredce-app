<?php

/**
 * Script de un solo uso para crear datos de prueba end-to-end:
 * un técnico demo, un servicio, una válvula, y la asignación entre ellos.
 *
 * Correrlo en el servidor real (tiene PHP; esta máquina de desarrollo no):
 *   php backend/sql/seed_demo_tecnico.php
 *
 * Usa las mismas credenciales de .env que usa el API.
 */

require __DIR__ . '/../src/autoload.php';

use FredceApp\Env;
use FredceApp\Database;

Env::load(__DIR__ . '/../.env');

$pdo = Database::connection();

$usuario = 'demo';
$password = 'demo1234';
$hash = password_hash($password, PASSWORD_BCRYPT);

$pdo->prepare(
    'INSERT INTO tecnicos (nombre, usuario, password_hash)
     VALUES (:nombre, :usuario, :hash)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)'
)->execute(['nombre' => 'Técnico Demo', 'usuario' => $usuario, 'hash' => $hash]);

$tecnicoId = (int) $pdo->query("SELECT id FROM tecnicos WHERE usuario = '$usuario'")->fetchColumn();

$folio = 'SERV-' . date('Y') . '-0001';
$pdo->prepare(
    'INSERT INTO servicios (folio, nombre, fecha, estatus)
     VALUES (:folio, :nombre, CURDATE(), "en_proceso")
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)'
)->execute(['folio' => $folio, 'nombre' => 'Servicio de prueba']);

$servicioId = (int) $pdo->query("SELECT id FROM servicios WHERE folio = '$folio'")->fetchColumn();

$pdo->prepare(
    'INSERT IGNORE INTO valvulas (servicio_id, codigo, estatus) VALUES (:sid, :codigo, "pendiente")'
)->execute(['sid' => $servicioId, 'codigo' => 'VALV-01']);

$pdo->prepare(
    'INSERT IGNORE INTO servicio_tecnico (servicio_id, tecnico_id) VALUES (:sid, :tid)'
)->execute(['sid' => $servicioId, 'tid' => $tecnicoId]);

echo "Listo. Login de prueba -> usuario: $usuario / password: $password\n";
echo "Servicio de prueba: $folio (id $servicioId)\n";
