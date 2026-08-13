import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const configuredPhp = process.env.PHP_BINARY;
const windowsXamppPhp = 'C:\\xampp\\php\\php.exe';
const phpBinary = configuredPhp
  || (process.platform === 'win32' && existsSync(windowsXamppPhp) ? windowsXamppPhp : 'php');

const php = spawn(
  phpBinary,
  [
    '-d', `session.save_path=${tmpdir()}`,
    '-d', 'upload_max_filesize=25M',
    '-d', 'post_max_size=30M',
    '-S', 'localhost:8080',
  ],
  { cwd: process.cwd(), stdio: 'inherit' },
);

php.on('error', (error) => {
  console.error(`Unable to start PHP (${phpBinary}): ${error.message}`);
  console.error('Install PHP, add it to PATH, or set PHP_BINARY to the php executable path.');
  process.exitCode = 1;
});

php.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
