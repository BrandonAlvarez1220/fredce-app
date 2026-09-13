<?php

use FredceApp\Env;
use FredceApp\Router;
use FredceApp\Response;
use FredceApp\Controllers\AuthController;
use FredceApp\Controllers\SyncController;
use FredceApp\Controllers\FotoController;

require __DIR__ . '/../src/autoload.php';

Env::load(__DIR__ . '/../.env');

header('Access-Control-Allow-Origin: *'); // TODO: restringir cuando se defina el dominio del panel admin
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

set_exception_handler(function (Throwable $e) {
    error_log($e->getMessage() . "\n" . $e->getTraceAsString());
    Response::json(['error' => 'Error interno del servidor'], 500);
});

$router = new Router();

$router->post('/api/auth/login', fn () => AuthController::login());
$router->get('/api/etapas', fn () => SyncController::etapas());
$router->get('/api/servicios', fn () => SyncController::servicios());
$router->get('/api/valvulas/{id}', fn (array $p) => SyncController::valvulaDetalle($p));
$router->post('/api/fotos', fn () => FotoController::store());

// PATH_INFO es más portable en shared hosting que depender de mod_rewrite
// exclusivamente; el .htaccess de todos modos reescribe a index.php.
$path = $_SERVER['PATH_INFO'] ?? $_SERVER['REQUEST_URI'] ?? '/';

$router->dispatch($_SERVER['REQUEST_METHOD'], $path);
