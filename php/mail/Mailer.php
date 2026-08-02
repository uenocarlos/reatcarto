<?php

declare(strict_types=1);

class Mailer
{
    /** @var list<array{type: string, to: string, subject: string, body: string}> */
    private static array $sent = [];

    private static bool $recordOnly = false;

    public static function enableRecording(bool $enabled = true): void
    {
        self::$recordOnly = $enabled;
        if ($enabled) {
            self::$sent = [];
        }
    }

    /** @return list<array{type: string, to: string, subject: string, body: string}> */
    public static function recordedMessages(): array
    {
        return self::$sent;
    }

    public static function clearRecorded(): void
    {
        self::$sent = [];
    }

    public static function sendVerificationEmail(string $to, string $rawToken): bool
    {
        $url = self::appBaseUrl() . '/verify?token=' . urlencode($rawToken);
        $subject = 'Verify your ReatCarto account';
        $body = "Please verify your email by opening this link (valid for 24 hours):\n\n{$url}\n";

        return self::send('verification', $to, $subject, $body);
    }

    public static function sendPasswordResetEmail(string $to, string $rawToken): bool
    {
        $url = self::appBaseUrl() . '/reset-password?token=' . urlencode($rawToken);
        $subject = 'Reset your ReatCarto password';
        $body = "Reset your password using this link (valid for 24 hours):\n\n{$url}\n";

        return self::send('password_reset', $to, $subject, $body);
    }

    public static function sendEmailChangeVerification(string $to, string $rawToken): bool
    {
        $url = self::appBaseUrl() . '/verify?token=' . urlencode($rawToken) . '&type=email_change';
        $subject = 'Confirm your new ReatCarto email';
        $body = "Confirm your new email using this link (valid for 24 hours):\n\n{$url}\n";

        return self::send('email_change', $to, $subject, $body);
    }

    /**
     * @param array<string, mixed> $admin
     */
    public static function sendAdminActionNotification(
        string $to,
        string $subject,
        string $reason,
        array $admin,
        string $targetType,
        string $targetId,
    ): bool {
        $adminLabel = (string) ($admin['username'] ?? 'administrator');
        $body = "An administrator action was performed on your ReatCarto account or content.\n\n"
            . "Action: {$subject}\n"
            . "Administrator: {$adminLabel}\n"
            . "Target: {$targetType} {$targetId}\n"
            . "Reason: {$reason}\n"
            . 'Time: ' . gmdate('c') . "\n";

        return self::send('admin_action', $to, $subject, $body);
    }

    private static function appBaseUrl(): string
    {
        return rtrim(env_string('APP_BASE_URL', 'http://localhost:5173') ?? 'http://localhost:5173', '/');
    }

    private static function send(string $type, string $to, string $subject, string $body): bool
    {
        self::$sent[] = [
            'type' => $type,
            'to' => $to,
            'subject' => $subject,
            'body' => $body,
        ];

        if (self::$recordOnly) {
            return true;
        }

        $smtp = app_config()['smtp'];
        $headers = [
            'From: ' . $smtp['from'],
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
        ];

        try {
            if (self::isLocalSmtpHost($smtp['host'])) {
                return self::sendViaSmtp(
                    $smtp['host'],
                    (int) $smtp['port'],
                    (string) $smtp['from'],
                    (string) $smtp['user'],
                    (string) $smtp['pass'],
                    $to,
                    $subject,
                    $body,
                    $headers,
                );
            }

            return mail($to, $subject, $body, implode("\r\n", $headers));
        } catch (Throwable $e) {
            error_log('Mailer send failure: ' . $e->getMessage());

            return false;
        }
    }

    private static function isLocalSmtpHost(string $host): bool
    {
        return $host === 'localhost' || $host === '127.0.0.1';
    }

    /**
     * @param list<string> $headers
     */
    private static function sendViaSmtp(
        string $host,
        int $port,
        string $from,
        string $user,
        string $pass,
        string $to,
        string $subject,
        string $body,
        array $headers,
    ): bool {
        $socket = @fsockopen($host, $port, $errno, $errstr, 5);
        if ($socket === false) {
            error_log("Mailer: SMTP connection failed: {$errstr}");

            return false;
        }

        stream_set_timeout($socket, 5);

        try {
            if (!self::smtpExpect($socket, 220)) {
                return false;
            }

            $hostname = gethostname() ?: 'localhost';
            if (!self::smtpCommand($socket, "EHLO {$hostname}", [250])
                && !self::smtpCommand($socket, "HELO {$hostname}", [250])) {
                return false;
            }

            if ($user !== '' && $pass !== '') {
                if (!self::smtpAuth($socket, $user, $pass)) {
                    return false;
                }
            }

            $fromAddress = self::extractEmailAddress($from);
            if (!self::smtpCommand($socket, "MAIL FROM:<{$fromAddress}>", [250])) {
                return false;
            }

            if (!self::smtpCommand($socket, "RCPT TO:<{$to}>", [250])) {
                return false;
            }

            if (!self::smtpCommand($socket, 'DATA', [354])) {
                return false;
            }

            $message = 'Subject: ' . $subject . "\r\n"
                . implode("\r\n", $headers)
                . "\r\n\r\n"
                . $body;
            $message = self::dotStuff($message);
            fwrite($socket, $message . "\r\n.\r\n");

            if (!self::smtpExpect($socket, 250)) {
                return false;
            }

            self::smtpCommand($socket, 'QUIT', [221]);

            return true;
        } finally {
            fclose($socket);
        }
    }

    private static function smtpAuth($socket, string $user, string $pass): bool
    {
        if (!self::smtpCommand($socket, 'AUTH LOGIN', [334])) {
            return false;
        }

        if (!self::smtpCommand($socket, base64_encode($user), [334])) {
            return false;
        }

        return self::smtpCommand($socket, base64_encode($pass), [235]);
    }

    /** @return list<string> */
    private static function smtpReadResponse($socket): array
    {
        $lines = [];
        while (($line = fgets($socket)) !== false) {
            $lines[] = rtrim($line, "\r\n");
            if (strlen($line) >= 4 && $line[3] === ' ') {
                break;
            }
        }

        return $lines;
    }

    private static function smtpExpect($socket, int $code): bool
    {
        $lines = self::smtpReadResponse($socket);
        if ($lines === []) {
            error_log('Mailer: SMTP empty response');

            return false;
        }

        $got = (int) substr($lines[0], 0, 3);
        if ($got !== $code) {
            error_log('Mailer: SMTP expected ' . $code . ', got: ' . implode(' | ', $lines));

            return false;
        }

        return true;
    }

    /** @param list<int> $expectedCodes */
    private static function smtpCommand($socket, string $command, array $expectedCodes): bool
    {
        fwrite($socket, $command . "\r\n");
        $lines = self::smtpReadResponse($socket);
        if ($lines === []) {
            error_log('Mailer: SMTP empty response for command: ' . $command);

            return false;
        }

        $got = (int) substr($lines[0], 0, 3);
        if (!in_array($got, $expectedCodes, true)) {
            error_log('Mailer: SMTP command failed: ' . $command . ' -> ' . implode(' | ', $lines));

            return false;
        }

        return true;
    }

    private static function extractEmailAddress(string $from): string
    {
        if (preg_match('/<([^>]+)>/', $from, $matches) === 1) {
            return $matches[1];
        }

        return $from;
    }

    private static function dotStuff(string $message): string
    {
        return preg_replace('/^\./m', '..', $message) ?? $message;
    }
}
