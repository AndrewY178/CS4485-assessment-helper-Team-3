-- sample users for dev only
-- password_hash is a placeholder so these accounts cannot log in.

INSERT INTO users (username, email, password_hash) VALUES
  ('alice', 'alice@example.com', 'PLACEHOLDER-not-a-real-hash'),
  ('bob',   'bob@example.com',   'PLACEHOLDER-not-a-real-hash');
