<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$host = 'localhost';
$port = '5432';
$dbname = 'carlos';
$user = 'postgres';
$password = 'cma352425';

try {
    $db = new PDO("pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Receber dados via POST
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    
    if (!$data || !is_array($data)) {
        throw new Exception('Dados inválidos recebidos (JSON malformado ou estrutura não é array)');
    }

    $results = [];
    $db->beginTransaction();

    // Captura mapa atual da sessão para vincular novos elementos ao mapa
    session_start();
    $mapaIdAtual = isset($_SESSION['mapa_id_atual']) ? (int)$_SESSION['mapa_id_atual'] : null;

    foreach ($data as $item) {
        if (empty($item['userId']) || empty($item['geon']) || empty($item['properties'])) {
            throw new Exception('Dados incompletos recebidos');
        }

        // Garante que cada elemento seja associado ao mapa atual nos properties
        if (is_array($item['properties'])) {
            $properties = $item['properties'];
        } else {
            $properties = json_decode($item['properties'], true);
            if (!is_array($properties)) {
                $properties = [];
            }
        }
        if ($mapaIdAtual) {
            $properties['mapa_id'] = $mapaIdAtual;
        }
        $propertiesJson = json_encode($properties, JSON_UNESCAPED_UNICODE);
        if ($propertiesJson === false) {
            throw new Exception('Falha ao serializar propriedades para JSON');
        }

        // Preparar geon para PostGIS (aceitar objeto/array ou string JSON)
        if (!isset($item['geon'])) {
            throw new Exception('Campo geon ausente');
        }
        $geonJson = is_array($item['geon']) ? json_encode($item['geon'], JSON_UNESCAPED_UNICODE) : $item['geon'];
        if ($geonJson === null) {
            throw new Exception('Geometria inválida');
        }

        $sql = "INSERT INTO social (geon, properties, user_id) 
                VALUES (ST_SetSRID(ST_GeomFromGeoJSON(:geon), 4326), :properties, :userId) 
                RETURNING id";
        
        $stmt = $db->prepare($sql);
        $stmt->bindParam(':geon', $geonJson, PDO::PARAM_STR);
        $stmt->bindParam(':properties', $propertiesJson, PDO::PARAM_STR);
        $stmt->bindParam(':userId', $item['userId'], PDO::PARAM_INT);
        
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $results[] = ['id' => $result['id'], 'success' => true];
    }

    $db->commit();
    echo json_encode(['success' => true, 'results' => $results]);

} catch (Exception $e) {
    if (isset($db)) $db->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
