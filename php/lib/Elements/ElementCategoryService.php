<?php

declare(strict_types=1);

const ELEMENT_CATEGORY_BUILTIN_SLUGS = ['terra', 'agua', 'conflito'];

/**
 * @return array<int, array{id: string, label: string, builtin: bool}>
 */
function list_user_element_categories(string $userId): array
{
    $stmt = db()->prepare(
        'SELECT slug, label FROM user_element_categories
         WHERE user_id = :user_id
         ORDER BY label ASC'
    );
    $stmt->execute(['user_id' => $userId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $categories = [];
    foreach ($rows as $row) {
        $categories[] = [
            'id' => (string) $row['slug'],
            'label' => (string) $row['label'],
            'builtin' => false,
        ];
    }

    return $categories;
}

function slugify_element_category_label(string $label): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $label);
    $ascii = is_string($ascii) ? $ascii : $label;
    $slug = strtolower(trim($ascii));
    $slug = preg_replace('/[^a-z0-9]+/', '_', $slug) ?? '';
    $slug = trim((string) $slug, '_');
    if ($slug === '') {
        $slug = 'tipo_personalizado';
    }

    return $slug;
}

/**
 * @return array{id: string, label: string, builtin: bool}
 */
function create_user_element_category(string $userId, string $label): array
{
    $label = trim($label);
    if ($label === '') {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'label' => 'Label is required.',
        ]);
    }
    if (strlen($label) > AUTH_TEXT_MAX) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'label' => 'Label is too long.',
        ]);
    }
    if (contains_hostile_markup($label)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'label' => 'Label contains invalid characters.',
        ]);
    }

    $pdo = db();
    $existingStmt = $pdo->prepare(
        'SELECT slug, label FROM user_element_categories
         WHERE user_id = :user_id AND lower(label) = lower(:label)
         LIMIT 1'
    );
    $existingStmt->execute([
        'user_id' => $userId,
        'label' => $label,
    ]);
    $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);
    if ($existing !== false) {
        return [
            'id' => (string) $existing['slug'],
            'label' => (string) $existing['label'],
            'builtin' => false,
        ];
    }

    $baseSlug = slugify_element_category_label($label);
    if (in_array($baseSlug, ELEMENT_CATEGORY_BUILTIN_SLUGS, true)) {
        $baseSlug .= '_custom';
    }

    $slug = $baseSlug;
    $suffix = 2;
    while (true) {
        $check = $pdo->prepare(
            'SELECT 1 FROM user_element_categories
             WHERE user_id = :user_id AND slug = :slug
             LIMIT 1'
        );
        $check->execute([
            'user_id' => $userId,
            'slug' => $slug,
        ]);
        if ($check->fetchColumn() === false) {
            break;
        }
        $slug = $baseSlug . '_' . $suffix;
        $suffix += 1;
    }

    $insert = $pdo->prepare(
        'INSERT INTO user_element_categories (user_id, slug, label)
         VALUES (:user_id, :slug, :label)
         RETURNING slug, label'
    );
    $insert->execute([
        'user_id' => $userId,
        'slug' => $slug,
        'label' => $label,
    ]);
    $row = $insert->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        auth_fail('server_error', 'Could not create category.', 500);
    }

    return [
        'id' => (string) $row['slug'],
        'label' => (string) $row['label'],
        'builtin' => false,
    ];
}

/**
 * @return array{success: true, categories: array<int, array{id: string, label: string, builtin: bool}>}
 */
function auth_list_element_categories(array $user): array
{
    return [
        'success' => true,
        'categories' => list_user_element_categories((string) $user['id']),
    ];
}

/**
 * @return array{success: true, category: array{id: string, label: string, builtin: bool}}
 */
function auth_add_element_category(array $user, array $input): array
{
    $label = isset($input['label']) && is_string($input['label']) ? $input['label'] : '';

    return [
        'success' => true,
        'category' => create_user_element_category((string) $user['id'], $label),
    ];
}
