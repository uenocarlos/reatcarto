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

    $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $proprietario_id = (int)$_SESSION['usuario_id'];

    if (!$id) {
        throw new Exception('ID do mapa não fornecido');
    }

    $stmt = $db->prepare("SELECT * FROM mapas WHERE id = :id AND proprietario_id = :proprietario_id");
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->bindParam(':proprietario_id', $proprietario_id, PDO::PARAM_INT);
    $stmt->execute();
    
    $map = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$map) {
        http_response_code(404);
        echo json_encode(['error' => 'Mapa não encontrado']);
        exit;
    }

    echo json_encode([
        'id' => $map['id'],
        'name' => $map['nome'],
        'description' => $map['descricao'],
        'created_date' => $map['data_criacao'],
        'center_lat' => $map['center_lat'],
        'center_lng' => $map['center_lng'],
        'zoom' => $map['zoom']
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
