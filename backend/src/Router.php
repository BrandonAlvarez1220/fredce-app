<?php

namespace FredceApp;

/**
 * Router mínimo: sin dependencias externas a propósito (hosting compartido).
 * Soporta parámetros de ruta con el patrón "/valvulas/{id}".
 */
class Router
{
    /** @var array<int, array{method:string, pattern:string, handler:callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = ['method' => strtoupper($method), 'pattern' => $pattern, 'handler' => $handler];
    }

    public function get(string $pattern, callable $handler): void  { $this->add('GET', $pattern, $handler); }
    public function post(string $pattern, callable $handler): void { $this->add('POST', $pattern, $handler); }

    public function dispatch(string $method, string $path): void
    {
        $path = '/' . trim(parse_url($path, PHP_URL_PATH) ?? '', '/');

        foreach ($this->routes as $route) {
            if ($route['method'] !== strtoupper($method)) {
                continue;
            }
            $params = $this->match($route['pattern'], $path);
            if ($params !== null) {
                call_user_func($route['handler'], $params);
                return;
            }
        }

        Response::json(['error' => 'Ruta no encontrada'], 404);
    }

    /** @return array<string,string>|null */
    private function match(string $pattern, string $path): ?array
    {
        $patternParts = explode('/', trim($pattern, '/'));
        $pathParts = explode('/', trim($path, '/'));

        if (count($patternParts) !== count($pathParts)) {
            return null;
        }

        $params = [];
        foreach ($patternParts as $i => $part) {
            if (str_starts_with($part, '{') && str_ends_with($part, '}')) {
                $params[substr($part, 1, -1)] = $pathParts[$i];
            } elseif ($part !== $pathParts[$i]) {
                return null;
            }
        }
        return $params;
    }
}
