<?php
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

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

    // Garantir que tabela 'mapas' exista com os campos necessários
    $db->exec("CREATE TABLE IF NOT EXISTS mapas ( 
        id SERIAL PRIMARY KEY, 
        nome VARCHAR(100) NOT NULL, 
        descricao TEXT, 
        proprietario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, 
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
        publico BOOLEAN DEFAULT FALSE,
        center_lat DOUBLE PRECISION,
        center_lng DOUBLE PRECISION,
        zoom INTEGER DEFAULT 13
    )");

    $proprietario_id = (int)$_SESSION['usuario_id'];
    
    // Receber JSON
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    $nome = trim($data['name'] ?? '');
    $descricao = trim($data['description'] ?? '');
    $publico = isset($data['publico']) ? (bool)$data['publico'] : false;
    $center_lat = $data['center_lat'] ?? -32.035;
    $center_lng = $data['center_lng'] ?? -52.1;
    $zoom = $data['zoom'] ?? 13;

    if ($nome === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Nome do mapa é obrigatório']);
        exit;
    }

    $sql = "INSERT INTO mapas (nome, descricao, proprietario_id, publico, center_lat, center_lng, zoom) 
            VALUES (:nome, :descricao, :proprietario_id, :publico, :center_lat, :center_lng, :zoom) 
            RETURNING id";
    $stmt = $db->prepare($sql);

    $stmt->bindParam(':nome', $nome);
    $stmt->bindParam(':descricao', $descricao);
    $stmt->bindParam(':proprietario_id', $proprietario_id);
    $stmt->bindParam(':publico', $publico, PDO::PARAM_BOOL);
    $stmt->bindParam(':center_lat', $center_lat);
    $stmt->bindParam(':center_lng', $center_lng);
    $stmt->bindParam(':zoom', $zoom);

    $stmt->execute();
    $mapa_id = $stmt->fetchColumn();

    // Armazena mapa atual na sessão para usar no perfil
    $_SESSION['mapa_id_atual'] = (int)$mapa_id;

    echo json_encode(['success' => true, 'mapa_id' => (int)$mapa_id]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro no banco de dados', 'details' => $e->getMessage()]);
}
?>
