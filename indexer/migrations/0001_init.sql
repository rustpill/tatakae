-- Migration number: 0001 	 2026-03-21T03:52:19.507Z
CREATE TABLE IF NOT EXISTS battle_history (
  id             TEXT PRIMARY KEY,
  signer         TEXT NOT NULL,
  signer_nft     TEXT NOT NULL,
  opponent       TEXT NOT NULL,
  opponent_nft   TEXT NOT NULL,
  winner         TEXT NOT NULL,
  battle_mode    TEXT NOT NULL,
  signer_power   INTEGER NOT NULL,
  opponent_power INTEGER NOT NULL,
  resolved_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signer   ON battle_history(signer);
CREATE INDEX IF NOT EXISTS idx_opponent ON battle_history(opponent);