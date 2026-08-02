<?php

declare(strict_types=1);

const AUTH_PASSWORD_MIN = 8;
const AUTH_PASSWORD_MAX = 128;
const AUTH_USERNAME_MIN = 3;
const AUTH_USERNAME_MAX = 32;
const AUTH_TEXT_MAX = 255;
const AUTH_PHONE_MAX = 32;

function validate_username(?string $username): ?string
{
    if ($username === null || trim($username) === '') {
        return 'Username is required.';
    }
    $username = trim($username);
    if (strlen($username) < AUTH_USERNAME_MIN) {
        return 'Username must be at least ' . AUTH_USERNAME_MIN . ' characters.';
    }
    if (strlen($username) > AUTH_USERNAME_MAX) {
        return 'Username must be at most ' . AUTH_USERNAME_MAX . ' characters.';
    }
    if (!preg_match('/^[a-zA-Z0-9._-]+$/', $username)) {
        return 'Username contains invalid characters.';
    }

    return null;
}

function validate_email(?string $email): ?string
{
    if ($email === null || trim($email) === '') {
        return 'Email is required.';
    }
    $email = trim($email);
    if (strlen($email) > AUTH_TEXT_MAX) {
        return 'Email is too long.';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return 'Email format is invalid.';
    }

    return null;
}

function validate_password(?string $password): ?string
{
    if ($password === null || $password === '') {
        return 'Password is required.';
    }
    $len = strlen($password);
    if ($len < AUTH_PASSWORD_MIN) {
        return 'Password must be at least ' . AUTH_PASSWORD_MIN . ' characters.';
    }
    if ($len > AUTH_PASSWORD_MAX) {
        return 'Password must be at most ' . AUTH_PASSWORD_MAX . ' characters.';
    }

    return null;
}

function validate_required_text(?string $value, string $fieldLabel, int $max = AUTH_TEXT_MAX): ?string
{
    if ($value === null || trim($value) === '') {
        return $fieldLabel . ' is required.';
    }
    if (strlen(trim($value)) > $max) {
        return $fieldLabel . ' is too long.';
    }

    return null;
}

function sanitize_error_message(string $message): string
{
    return htmlspecialchars(strip_tags($message), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function contains_hostile_markup(string $value): bool
{
    return preg_match('/<[^>]+>/', $value) === 1;
}
