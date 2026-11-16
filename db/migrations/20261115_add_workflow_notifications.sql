SET @observee_status_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'observees'
      AND column_name = 'status'
);
SET @observee_status_migration = IF(
    @observee_status_exists = 0,
    "ALTER TABLE observees ADD COLUMN status ENUM('not_generated','generated','no_observers','approved','manual') NOT NULL DEFAULT 'not_generated'",
    'SELECT 1'
);
PREPARE migration_statement FROM @observee_status_migration;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @meeting_course_id_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'meetings'
      AND column_name = 'course_id'
);
SET @meeting_course_id_migration = IF(
    @meeting_course_id_exists = 0,
    'ALTER TABLE meetings ADD COLUMN course_id INT NULL',
    'SELECT 1'
);
PREPARE migration_statement FROM @meeting_course_id_migration;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @legacy_meeting_columns = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'meetings'
      AND column_name IN ('semester', 'department', 'course_number', 'section_number')
);
SET @link_legacy_meetings = IF(
    @legacy_meeting_columns = 4,
    'UPDATE meetings m JOIN courses c ON c.semester = m.semester AND c.department = m.department AND c.course_number = m.course_number AND c.section_number = m.section_number SET m.course_id = c.course_id WHERE m.course_id IS NULL',
    'SELECT 1'
);
PREPARE migration_statement FROM @link_legacy_meetings;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

CREATE TABLE IF NOT EXISTS evaluation_cycles (
    semester VARCHAR(50) PRIMARY KEY,
    cycle_status ENUM('draft', 'signup', 'observation', 'feedback', 'closed')
        NOT NULL DEFAULT 'draft',
    signup_deadline DATETIME NOT NULL,
    observation_deadline DATETIME NOT NULL,
    feedback_deadline DATETIME NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signup_dates (
    observee_id INT NOT NULL,
    signup_sem VARCHAR(50) NOT NULL,
    offered_date DATE NOT NULL,
    PRIMARY KEY (observee_id, signup_sem, offered_date)
);

CREATE TABLE IF NOT EXISTS observation_requests (
    meeting_id INT NOT NULL,
    observer_id INT NOT NULL,
    status ENUM(
        'generated', 'approved', 'pending', 'accepted',
        'declined', 'confirmed', 'not_selected', 'expired'
    ) NOT NULL DEFAULT 'approved',
    selected_date DATE NULL,
    sent_at DATETIME NULL,
    responded_at DATETIME NULL,
    PRIMARY KEY (meeting_id, observer_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id),
    FOREIGN KEY (observer_id) REFERENCES professors(professor_id)
);

CREATE TABLE IF NOT EXISTS feedback (
    semester VARCHAR(50) NOT NULL,
    professor_id INT NOT NULL,
    semester_role ENUM('observee', 'observer', 'both') NOT NULL DEFAULT 'observee',
    process_OK ENUM('yes', 'mostly', 'no') NOT NULL,
    difficulties TEXT,
    improvements TEXT,
    PRIMARY KEY (semester, professor_id),
    FOREIGN KEY (professor_id) REFERENCES professors(professor_id)
);

CREATE TABLE IF NOT EXISTS observer_escalations (
    observee_id INT NOT NULL,
    signup_sem VARCHAR(50) NOT NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (observee_id, signup_sem),
    FOREIGN KEY (observee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deadline_notification_deliveries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    semester VARCHAR(50) NOT NULL,
    recipient_id INT NOT NULL,
    reminder_key VARCHAR(40) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    email_sent_at TIMESTAMP NULL DEFAULT NULL,
    email_attempts INT NOT NULL DEFAULT 0,
    last_email_attempt_at TIMESTAMP NULL DEFAULT NULL,
    last_email_error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_deadline_delivery (semester, recipient_id, reminder_key),
    INDEX idx_deadline_delivery_pending (email_sent_at, created_at),
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);
