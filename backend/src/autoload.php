<?php

/**
 * Autoloader mínimo estilo PSR-4 para el namespace FredceApp, sin Composer.
 */
spl_autoload_register(function (string $class): void {
    $prefix = 'FredceApp\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});
