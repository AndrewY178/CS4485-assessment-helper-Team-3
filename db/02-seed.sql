-- sample users for dev only
-- password_hash is a placeholder so these accounts cannot log in.

INSERT INTO users (username, email, password_hash) VALUES
  ('alice', 'alice@example.com', 'PLACEHOLDER-not-a-real-hash'),
  ('bob',   'bob@example.com',   'PLACEHOLDER-not-a-real-hash');

-- hardcoded AC account for dev, so there is someone who can create the other accounts
-- password_hash is NULL (no password set), so it cannot log in until a set-password token is issued for it
INSERT INTO users (username, email, password_hash) VALUES
  ('ac_original', 'ac_original@example.com', NULL);

INSERT INTO professors (professor_id, professor_name)
  SELECT id, 'Dev Original AC' FROM users WHERE username = 'ac_original';

INSERT INTO assessment_committee (ac_id)
  SELECT id FROM users WHERE username = 'ac_original';
