CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username CITEXT NOT NULL UNIQUE,
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    organization TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('field', 'admin')),
    status TEXT NOT NULL CHECK (status IN ('pending_verification', 'active', 'deactivated')),
    email_verified_at TIMESTAMPTZ NULL,
    pending_email CITEXT NULL,
    terms_version TEXT NOT NULL DEFAULT '',
    privacy_version TEXT NOT NULL DEFAULT '',
    consent_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    center_lat DOUBLE PRECISION NOT NULL DEFAULT -32.035,
    center_lng DOUBLE PRECISION NOT NULL DEFAULT -52.1,
    zoom INT NOT NULL DEFAULT 13,
    is_published BOOLEAN NOT NULL DEFAULT false,
    moderated_at TIMESTAMPTZ NULL,
    moderation_reason TEXT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maps_owner_id_idx ON maps (owner_id);
