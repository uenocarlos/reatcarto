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

    $proprietario_id = (int)$_SESSION['usuario_id'];
    
    $stmt = $db->prepare("SELECT * FROM mapas WHERE proprietario_id = :proprietario_id ORDER BY data_criacao DESC");
    $stmt->bindParam(':proprietario_id', $proprietario_id, PDO::PARAM_INT);
    $stmt->execute();
    
    $mapas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Map database fields to frontend fields
    $result = array_map(function($m) {
        return [
            'id' => $m['id'],
            'name' => $m['nome'],
            'description' => $m['descricao'],
            'created_date' => $m['data_criacao'],
            'center_lat' => $m['center_lat'],
            'center_lng' => $m['center_lng'],
            'zoom' => $m['zoom']
        ];
    }, $mapas);

    echo json_encode($result);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
