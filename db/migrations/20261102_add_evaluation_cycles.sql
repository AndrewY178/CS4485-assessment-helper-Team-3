-- Add evaluation cycles to an existing database.
-- Run this migration once.

CREATE TABLE evaluation_cycles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    semester_id VARCHAR(20) NOT NULL UNIQUE,
    semester_label VARCHAR(20) NOT NULL,
    cycle_status ENUM('draft', 'signup', 'observation', 'feedback', 'closed')
        NOT NULL DEFAULT 'draft',
    signup_deadline DATETIME NOT NULL,
    observation_deadline DATETIME NOT NULL,
    feedback_deadline DATETIME NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);
