CREATE TABLE IF NOT EXISTS auth_rate_limits (
    bucket_key TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    attempt_count INT NOT NULL DEFAULT 1,
    PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_window_idx ON auth_rate_limits (window_start);
