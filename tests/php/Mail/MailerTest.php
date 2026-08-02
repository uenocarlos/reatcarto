<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Mail;

use Mailer;
use PHPUnit\Framework\TestCase;

final class MailerTest extends TestCase
{
    /** @var array<string, mixed>|null */
    private ?array $originalSmtpConfig = null;

    /** @var resource|null */
    private $serverProcess = null;

    protected function setUp(): void
    {
        $this->originalSmtpConfig = app_config()['smtp'];
        Mailer::enableRecording(false);
        Mailer::clearRecorded();
    }

    protected function tearDown(): void
    {
        if ($this->serverProcess !== null) {
            proc_terminate($this->serverProcess);
            proc_close($this->serverProcess);
            $this->serverProcess = null;
        }

        if ($this->originalSmtpConfig !== null) {
            $GLOBALS['CONFIG']['smtp'] = $this->originalSmtpConfig;
        }

        Mailer::enableRecording(true);
        Mailer::clearRecorded();
    }

    public function testLocalhostSmtpPerformsFullHandshake(): void
    {
        ['commands' => $commands, 'sent' => $sent] = $this->runAgainstFakeSmtpServer('success');

        $this->assertTrue($sent);
        $this->assertNotEmpty($commands);
        $this->assertNotNull($this->firstCommandMatching($commands, '/^EHLO /'));
        $this->assertStringContainsString('MAIL FROM:<noreply@example.com>', implode("\n", $commands));
        $this->assertStringContainsString('RCPT TO:<recipient@example.com>', implode("\n", $commands));
        $this->assertContains('DATA', $commands);
        $this->assertContains('QUIT', $commands);
        $this->assertStringContainsString('Verify your ReatCarto account', implode("\n", $commands));
    }

    public function testLocalhostSmtpAuthenticatesWhenCredentialsConfigured(): void
    {
        ['commands' => $commands, 'sent' => $sent] = $this->runAgainstFakeSmtpServer('success', [
            'user' => 'smtp-user',
            'pass' => 'smtp-pass',
        ]);

        $this->assertTrue($sent);
        $this->assertContains('AUTH LOGIN', $commands);
        $this->assertContains(base64_encode('smtp-user'), $commands);
        $this->assertContains(base64_encode('smtp-pass'), $commands);
    }

    public function testLocalhostSmtpReturnsFalseWhenServerRejectsSender(): void
    {
        ['sent' => $sent] = $this->runAgainstFakeSmtpServer('reject_mail_from');

        $this->assertFalse($sent);
    }

    public function testLocalhostSmtpReturnsFalseWhenConnectionFails(): void
    {
        $this->overrideSmtpConfig([
            'host' => '127.0.0.1',
            'port' => 1,
        ]);

        $this->assertFalse($this->sendTestMessage());
    }

    /**
     * @param list<string> $commands
     */
    private function firstCommandMatching(array $commands, string $pattern): ?string
    {
        foreach ($commands as $command) {
            if (preg_match($pattern, $command) === 1) {
                return $command;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array{commands: list<string>, sent: bool}
     */
    private function runAgainstFakeSmtpServer(string $mode, array $overrides = []): array
    {
        $portFile = tempnam(sys_get_temp_dir(), 'smtp-port-');
        $commandsFile = tempnam(sys_get_temp_dir(), 'smtp-cmd-');
        $this->assertNotFalse($portFile);
        $this->assertNotFalse($commandsFile);

        $script = __DIR__ . DIRECTORY_SEPARATOR . 'fake_smtp_server.php';
        $command = escapeshellarg(PHP_BINARY)
            . ' '
            . escapeshellarg($script)
            . ' '
            . escapeshellarg($portFile)
            . ' '
            . escapeshellarg($commandsFile)
            . ' '
            . escapeshellarg($mode);

        $this->serverProcess = proc_open($command, [], $pipes);
        $this->assertIsResource($this->serverProcess);

        $deadline = microtime(true) + 5;
        while (microtime(true) < $deadline) {
            if (is_readable($portFile) && filesize($portFile) > 0) {
                break;
            }
            usleep(20_000);
        }

        $port = (int) trim((string) file_get_contents($portFile));
        $this->assertGreaterThan(0, $port);

        $this->overrideSmtpConfig(array_merge([
            'host' => '127.0.0.1',
            'port' => $port,
            'user' => '',
            'pass' => '',
            'from' => 'noreply@example.com',
        ], $overrides));

        $sent = $this->sendTestMessage();

        $deadline = microtime(true) + 5;
        while (microtime(true) < $deadline) {
            if (is_readable($commandsFile) && filesize($commandsFile) > 0) {
                break;
            }
            usleep(20_000);
        }

        proc_terminate($this->serverProcess);
        proc_close($this->serverProcess);
        $this->serverProcess = null;

        $raw = file_get_contents($commandsFile);
        @unlink($portFile);
        @unlink($commandsFile);

        $commands = json_decode((string) $raw, true);
        $this->assertIsArray($commands);

        /** @var list<string> $commands */
        return [
            'commands' => $commands,
            'sent' => $sent,
        ];
    }

    private function sendTestMessage(): bool
    {
        return Mailer::sendVerificationEmail('recipient@example.com', bin2hex(random_bytes(16)));
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function overrideSmtpConfig(array $overrides): void
    {
        $GLOBALS['CONFIG']['smtp'] = array_merge(app_config()['smtp'], $overrides);
    }
}
