CREATE TABLE login_attempts (
  bucket_hash TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0)
);

CREATE INDEX login_attempts_by_window ON login_attempts(window_started_at);
