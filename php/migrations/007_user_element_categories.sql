CREATE TABLE IF NOT EXISTS user_element_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_element_categories_slug_nonempty CHECK (char_length(trim(slug)) > 0),
    CONSTRAINT user_element_categories_label_nonempty CHECK (char_length(trim(label)) > 0),
    UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS user_element_categories_user_id_idx
    ON user_element_categories (user_id);
