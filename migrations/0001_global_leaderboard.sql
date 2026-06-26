CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  initials TEXT NOT NULL
    CHECK (length(initials) = 3 AND initials GLOB '[A-Z][A-Z][A-Z]'),
  score INTEGER NOT NULL
    CHECK (score > 0 AND score <= 999999999),
  created_at INTEGER NOT NULL,
  source TEXT,
  version TEXT
);

CREATE INDEX IF NOT EXISTS idx_scores_rank
  ON scores (score DESC, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_scores_created_at
  ON scores (created_at DESC);
