<?php

declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "Usage: fake_smtp_server.php <port-file> <commands-file> [mode]\n");
    exit(1);
}

$portFile = $argv[1];
$commandsFile = $argv[2];
$mode = $argv[3] ?? 'success';

$server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
if ($server === false) {
    fwrite(STDERR, "Failed to start SMTP server: {$errstr}\n");
    exit(1);
}

$address = stream_socket_get_name($server, false);
if ($address === false) {
    exit(1);
}

[, $port] = explode(':', $address);
file_put_contents($portFile, (string) $port);

$conn = stream_socket_accept($server, 10);
fclose($server);

if ($conn === false) {
    file_put_contents($commandsFile, json_encode(['error' => 'accept_timeout'], JSON_THROW_ON_ERROR));
    exit(1);
}

/** @var list<string> $commands */
$commands = [];

$write = static function ($socket, string $response) use (&$commands): void {
    fwrite($socket, $response);
};

$readCommand = static function ($socket) use (&$commands): ?string {
    $line = fgets($socket);
    if ($line === false) {
        return null;
    }

    $trimmed = rtrim($line, "\r\n");
    $commands[] = $trimmed;

    return $trimmed;
};

$write($conn, "220 mailpit.test ESMTP\r\n");

while (($command = $readCommand($conn)) !== null) {
    if (str_starts_with($command, 'EHLO') || str_starts_with($command, 'HELO')) {
        $write($conn, "250-mailpit.test\r\n250 AUTH LOGIN\r\n");
        continue;
    }

    if (str_starts_with($command, 'AUTH LOGIN')) {
        $write($conn, "334 VXNlcm5hbWU6\r\n");
        continue;
    }

    if ($command === base64_encode('smtp-user')) {
        $write($conn, "334 UGFzc3dvcmQ6\r\n");
        continue;
    }

    if ($command === base64_encode('smtp-pass')) {
        $write($conn, "235 Authentication successful\r\n");
        continue;
    }

    if (str_starts_with($command, 'MAIL FROM')) {
        if ($mode === 'reject_mail_from') {
            $write($conn, "550 Sender rejected\r\n");
            break;
        }
        $write($conn, "250 OK\r\n");
        continue;
    }

    if (str_starts_with($command, 'RCPT TO')) {
        $write($conn, "250 OK\r\n");
        continue;
    }

    if ($command === 'DATA') {
        $write($conn, "354 End data with <CR><LF>.<CR><LF>\r\n");
        while (($line = fgets($conn)) !== false) {
            $commands[] = rtrim($line, "\r\n");
            if ($line === ".\r\n") {
                break;
            }
        }
        $write($conn, "250 Message accepted\r\n");
        continue;
    }

    if (str_starts_with($command, 'QUIT')) {
        $write($conn, "221 Bye\r\n");
        break;
    }
}

fclose($conn);
file_put_contents($commandsFile, json_encode($commands, JSON_THROW_ON_ERROR));
