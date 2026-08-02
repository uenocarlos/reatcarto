<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Não autenticado']);
    exit;
}

$host = 'localhost';
$dbname = 'carlos';
$user = 'postgres';
$password = 'cma352425';
$port = '5432';

try {
    $db = new PDO("pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $map_id = isset($_GET['map_id']) ? (int)$_GET['map_id'] : null;
    $proprietario_id = (int)$_SESSION['usuario_id'];

    if ($map_id) {
        // Elements for a specific map
        $sql = "SELECT id, geon, properties, user_id FROM social WHERE (properties->>'map_id')::int = :map_id";
        $stmt = $db->prepare($sql);
        $stmt->bindParam(':map_id', $map_id, PDO::PARAM_INT);
    } else {
        // All elements for current user maps
        $sql = "SELECT s.id, s.geon, s.properties, s.user_id 
                FROM social s
                JOIN mapas m ON (s.properties->>'map_id')::int = m.id
                WHERE m.proprietario_id = :proprietario_id";
        $stmt = $db->prepare($sql);
        $stmt->bindParam(':proprietario_id', $proprietario_id, PDO::PARAM_INT);
    }

    $stmt->execute();
    $elementos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = array_map(function($e) {
        $props = json_decode($e['properties'], true);
        return [
            'id' => $e['id'],
            'map_id' => $props['map_id'] ?? null,
            'element_type' => json_decode($e['geon'], true)['type'] === 'Point' ? 'point' : (json_decode($e['geon'], true)['type'] === 'LineString' ? 'line' : 'polygon'),
            'geojson' => $e['geon'],
            'name' => $props['name'] ?? '',
            'description' => $props['description'] ?? '',
            'element_category' => $props['category'] ?? '',
            'style' => $props['style'] ?? null,
            'user_id' => $e['user_id']
        ];
    }, $elementos);

    echo json_encode($result);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
