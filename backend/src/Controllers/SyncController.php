<?php

namespace FredceApp\Controllers;

use FredceApp\Auth;
use FredceApp\Database;
use FredceApp\Response;

class SyncController
{
    /**
     * GET /api/etapas
     * Catálogo dinámico de etapas — se sincroniza igual que servicios/válvulas.
     */
    public static function etapas(): void
    {
        Auth::requireTecnico();

        $pdo = Database::connection();
        $stmt = $pdo->query('SELECT id, nombre, orden FROM etapas WHERE activo = 1 ORDER BY orden ASC');
        Response::json(['etapas' => $stmt->fetchAll()]);
    }

    /**
     * GET /api/servicios
     * Servicios asignados al técnico autenticado, con sus válvulas y conteo
     * de fotos por válvula (pantalla "Inicio" y "Detalle de servicio").
     */
    public static function servicios(): void
    {
        $tecnico = Auth::requireTecnico();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT s.id, s.folio, s.nombre, s.fecha, s.estatus
             FROM servicios s
             JOIN servicio_tecnico st ON st.servicio_id = s.id
             WHERE st.tecnico_id = :tid
             ORDER BY s.fecha DESC'
        );
        $stmt->execute(['tid' => $tecnico['id']]);
        $servicios = $stmt->fetchAll();

        if (!$servicios) {
            Response::json(['servicios' => []]);
            return;
        }

        $servicioIds = array_column($servicios, 'id');
        $placeholders = implode(',', array_fill(0, count($servicioIds), '?'));

        $stmt = $pdo->prepare(
            "SELECT v.id, v.servicio_id, v.codigo, v.estatus,
                    (SELECT COUNT(*) FROM fotos f WHERE f.valvula_id = v.id) AS total_fotos
             FROM valvulas v
             WHERE v.servicio_id IN ($placeholders)
             ORDER BY v.id ASC"
        );
        $stmt->execute($servicioIds);
        $valvulas = $stmt->fetchAll();

        $valvulasPorServicio = [];
        foreach ($valvulas as $v) {
            $valvulasPorServicio[$v['servicio_id']][] = [
                'id' => (int) $v['id'],
                'codigo' => $v['codigo'],
                'estatus' => $v['estatus'],
                'total_fotos' => (int) $v['total_fotos'],
            ];
        }

        foreach ($servicios as &$s) {
            $s['id'] = (int) $s['id'];
            $s['valvulas'] = $valvulasPorServicio[$s['id']] ?? [];
        }

        Response::json(['servicios' => $servicios]);
    }

    /**
     * GET /api/valvulas/{id}
     * Detalle de válvula: fotos agrupadas por etapa (pantalla "Detalle de válvula").
     * Verifica que la válvula pertenezca a un servicio asignado al técnico.
     */
    public static function valvulaDetalle(array $params): void
    {
        $tecnico = Auth::requireTecnico();
        $valvulaId = (int) $params['id'];
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT v.id, v.codigo, v.estatus, v.servicio_id
             FROM valvulas v
             JOIN servicio_tecnico st ON st.servicio_id = v.servicio_id
             WHERE v.id = :vid AND st.tecnico_id = :tid
             LIMIT 1'
        );
        $stmt->execute(['vid' => $valvulaId, 'tid' => $tecnico['id']]);
        $valvula = $stmt->fetch();

        if (!$valvula) {
            Response::json(['error' => 'Válvula no encontrada o no asignada a este técnico'], 404);
            return;
        }

        $stmt = $pdo->prepare(
            'SELECT f.id, f.client_uuid, f.etapa_id, f.drive_file_id, f.orden, f.etiqueta_libre, f.fecha_captura
             FROM fotos f
             WHERE f.valvula_id = :vid
             ORDER BY f.etapa_id ASC, f.orden ASC, f.fecha_captura ASC'
        );
        $stmt->execute(['vid' => $valvulaId]);
        $fotos = $stmt->fetchAll();

        Response::json([
            'valvula' => [
                'id' => (int) $valvula['id'],
                'codigo' => $valvula['codigo'],
                'estatus' => $valvula['estatus'],
                'servicio_id' => (int) $valvula['servicio_id'],
            ],
            'fotos' => $fotos,
        ]);
    }
}
