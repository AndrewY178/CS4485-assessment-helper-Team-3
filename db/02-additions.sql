-- Extra tables and changes needed by the endpoints.
-- Runs after 01-schema.sql (files run in alphabetical order).

-- A meeting can exist before an observer has accepted
ALTER TABLE meetings MODIFY observer_id INT NULL;

-- Observer invitations for a meeting (pending / accepted / declined / expired)
CREATE TABLE invitations (
    invitation_id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL,
    observer_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined', 'expired') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meeting_id, observer_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (observer_id) REFERENCES observers(observer_id)
);

-- One schedule per semester; the contents are JSON so the frontend decides the shape
CREATE TABLE semester_schedules (
    semester VARCHAR(20) PRIMARY KEY,
    details JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- A single row (id = 1) holding the current observation template
CREATE TABLE observation_template (
    id TINYINT PRIMARY KEY,
    content JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Feedback survey answers
CREATE TABLE feedback (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    answers JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
