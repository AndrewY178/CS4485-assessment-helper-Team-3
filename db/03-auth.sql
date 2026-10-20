-- authentication tables (users itself, with email/password_hash, is in 01-schema.sql).

-- for login sessions. stores only a SHA-256 hash of the session token,
-- never the raw token, so a database leak cannot be used to hijack sessions
CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- one-time links emailed to a user: the first "set your password" link after the AC
-- creates their account, and later "forgot password" links.
-- the link contains a random token, which the database stores a SHA-256 hash of
-- the raw token only exists inside the emailed link. used_at is filled in when the link is used so it works once.
CREATE TABLE password_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  purpose ENUM('set_password', 'reset_password') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
