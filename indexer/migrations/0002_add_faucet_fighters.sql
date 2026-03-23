-- Migration number: 0002 	 2026-03-22T23:45:21.607Z
CREATE TABLE faucet_fighters (
  mint        TEXT PRIMARY KEY,
  power       INTEGER NOT NULL,
  claimed_by  TEXT,           -- wallet address, null if unclaimed
  claimed_at  INTEGER         -- unix timestamp, null if unclaimed
);