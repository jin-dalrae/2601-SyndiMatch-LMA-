PRAGMA foreign_keys = ON;

CREATE TABLE syndications (
  id TEXT PRIMARY KEY,
  borrower TEXT NOT NULL,
  industry TEXT NOT NULL,
  total_amount INTEGER NOT NULL CHECK (total_amount > 0),
  target_amount INTEGER NOT NULL CHECK (target_amount > 0 AND target_amount <= total_amount),
  rating TEXT NOT NULL,
  initial_spread_bps INTEGER NOT NULL CHECK (initial_spread_bps > 0),
  clearing_spread_bps INTEGER,
  status TEXT NOT NULL CHECK (status IN ('open','book_building','awaiting_approval','approved','settled','rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_ticket INTEGER NOT NULL CHECK (min_ticket > 0),
  max_ticket INTEGER NOT NULL CHECK (max_ticket >= min_ticket),
  available_capacity INTEGER NOT NULL CHECK (available_capacity >= 0),
  max_concentration_bps INTEGER NOT NULL DEFAULT 2500 CHECK (max_concentration_bps BETWEEN 1 AND 10000)
);

CREATE TABLE bids (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  syndication_id TEXT NOT NULL REFERENCES syndications(id),
  participant_id TEXT NOT NULL REFERENCES participants(id),
  amount INTEGER NOT NULL,
  spread_bps INTEGER NOT NULL CHECK (spread_bps > 0),
  min_allocation INTEGER NOT NULL CHECK (min_allocation >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  reasoning TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_results_json TEXT NOT NULL CHECK (json_valid(policy_results_json)),
  source_state_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (syndication_id, participant_id)
);

CREATE TABLE allocation_proposals (
  syndication_id TEXT PRIMARY KEY REFERENCES syndications(id),
  version INTEGER NOT NULL CHECK (version > 0),
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_approval','approved','rejected')),
  target_amount INTEGER NOT NULL,
  allocated_amount INTEGER NOT NULL,
  residual_amount INTEGER NOT NULL,
  clearing_spread_bps INTEGER NOT NULL,
  allocations_json TEXT NOT NULL CHECK (json_valid(allocations_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE allocation_history (
  syndication_id TEXT NOT NULL REFERENCES syndications(id),
  version INTEGER NOT NULL,
  participant_id TEXT NOT NULL REFERENCES participants(id),
  bid_id TEXT NOT NULL REFERENCES bids(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  spread_bps INTEGER NOT NULL,
  PRIMARY KEY (syndication_id, version, participant_id)
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  syndication_id TEXT NOT NULL REFERENCES syndications(id),
  allocation_version INTEGER NOT NULL,
  allocation_fingerprint TEXT NOT NULL,
  actor TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved','override','rejected')),
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (syndication_id, allocation_version)
);

CREATE TABLE reviewer_sessions (
  token_hash TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role = 'reviewer'),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE workflow_commands (
  id TEXT PRIMARY KEY,
  syndication_id TEXT NOT NULL REFERENCES syndications(id),
  allocation_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed','failed')),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE settlements (
  id TEXT PRIMARY KEY,
  syndication_id TEXT NOT NULL REFERENCES syndications(id),
  allocation_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status = 'simulated'),
  receipt_json TEXT NOT NULL CHECK (json_valid(receipt_json)),
  created_at TEXT NOT NULL,
  UNIQUE (syndication_id, allocation_version)
);

CREATE TABLE workflow_events (
  id TEXT PRIMARY KEY,
  syndication_id TEXT REFERENCES syndications(id),
  event_type TEXT NOT NULL,
  actor TEXT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX bids_by_syndication ON bids(syndication_id, spread_bps, created_at);
CREATE INDEX events_by_syndication ON workflow_events(syndication_id, created_at);
CREATE INDEX sessions_by_expiry ON reviewer_sessions(expires_at);

INSERT INTO syndications VALUES
('SYND-DEMO-001','Northstar Data Infrastructure','Technology',500000000,300000000,'BB+',475,NULL,'book_building','2026-09-24T00:00:00.000Z','2026-09-24T00:00:00.000Z');

INSERT INTO participants VALUES
('PA-001','Apollo Credit',25000000,120000000,250000000,2500),
('PA-002','MetLife Investment Management',40000000,100000000,210000000,2500),
('PA-003','Blue Owl Capital',25000000,100000000,165000000,2500),
('PA-004','Barings LLC',10000000,80000000,165000000,2500),
('PA-005','KeyBank',15000000,80000000,170000000,2500);

INSERT INTO bids VALUES
('BID-DEMO-001','demo-001','SYND-DEMO-001','PA-001',100000000,455,50000000,'active','Yield and sector fit the recorded mandate.','participant-mandate-v1','[{"rule":"minimum_ticket","result":"passed"},{"rule":"maximum_single_ticket","result":"passed"},{"rule":"available_capacity","result":"passed"}]','2026-09-24T00:00:00.000Z','2026-09-24T00:01:00.000Z'),
('BID-DEMO-002','demo-002','SYND-DEMO-001','PA-002',90000000,460,40000000,'active','Credit quality fits the insurer mandate.','participant-mandate-v1','[{"rule":"minimum_ticket","result":"passed"},{"rule":"maximum_single_ticket","result":"passed"},{"rule":"available_capacity","result":"passed"}]','2026-09-24T00:00:00.000Z','2026-09-24T00:02:00.000Z'),
('BID-DEMO-003','demo-003','SYND-DEMO-001','PA-003',85000000,470,25000000,'active','Return clears the private-credit hurdle.','participant-mandate-v1','[{"rule":"minimum_ticket","result":"passed"},{"rule":"maximum_single_ticket","result":"passed"},{"rule":"available_capacity","result":"passed"}]','2026-09-24T00:00:00.000Z','2026-09-24T00:03:00.000Z'),
('BID-DEMO-004','demo-004','SYND-DEMO-001','PA-004',65000000,475,20000000,'active','Diversification benefit supports participation.','participant-mandate-v1','[{"rule":"minimum_ticket","result":"passed"},{"rule":"maximum_single_ticket","result":"passed"},{"rule":"available_capacity","result":"passed"}]','2026-09-24T00:00:00.000Z','2026-09-24T00:04:00.000Z');
