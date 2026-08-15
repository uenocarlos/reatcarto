<?php

declare(strict_types=1);

class AuthException extends Exception
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status,
        public readonly array $fields = [],
    ) {
        parent::__construct($message);
    }
}

class ConflictException extends AuthException
{
    public function __construct(
        string $message,
        public readonly array $localSnapshot,
        public readonly array $remoteSnapshot,
        public readonly string $kind = 'update_update',
    ) {
        parent::__construct('conflict', $message, 409);
    }
}

function auth_fail(string $code, string $message, int $status = 400, array $fields = []): never
{
    throw new AuthException($code, $message, $status, $fields);
}

function auth_handle_endpoint(callable $handler): never
{
    try {
        $result = $handler();
        json_response(is_array($result) ? $result : ['success' => true]);
    } catch (ConflictException $e) {
        json_response([
            'success' => false,
            'error' => [
                'code' => 'conflict',
                'message' => $e->getMessage(),
                'fields' => [],
                'kind' => $e->kind,
                'local_snapshot' => $e->localSnapshot,
                'remote_snapshot' => $e->remoteSnapshot,
            ],
        ], 409);
    } catch (AuthException $e) {
        json_error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
    } catch (Throwable) {
        json_error('server_error', 'Request failed.', 500);
    }
}

function auth_handle_endpoint_created(callable $handler): never
{
    try {
        $result = $handler();
        json_response(is_array($result) ? $result : ['success' => true], 201);
    } catch (ConflictException $e) {
        json_response([
            'success' => false,
            'error' => [
                'code' => 'conflict',
                'message' => $e->getMessage(),
                'fields' => [],
                'kind' => $e->kind,
                'local_snapshot' => $e->localSnapshot,
                'remote_snapshot' => $e->remoteSnapshot,
            ],
        ], 409);
    } catch (AuthException $e) {
        json_error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
    } catch (Throwable) {
        json_error('server_error', 'Request failed.', 500);
    }
}
