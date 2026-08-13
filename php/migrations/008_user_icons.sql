CREATE TABLE IF NOT EXISTS user_icons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type = 'image/png'),
    byte_size INT NOT NULL CHECK (byte_size > 0),
    library_hidden_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_icons_user_id_visible_idx
    ON user_icons (user_id)
    WHERE library_hidden_at IS NULL;
