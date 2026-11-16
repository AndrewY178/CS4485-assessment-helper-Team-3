CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMP NULL DEFAULT NULL,
    password_hash VARCHAR(255) NULL, -- if NULL: account created by AC, password not set yet (login refused)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient_id INT NOT NULL,
    sender_id INT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL DEFAULT NULL,
    dismissed_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_notifications_inbox (recipient_id, dismissed_at, created_at),
    INDEX idx_notifications_unread (recipient_id, read_at, dismissed_at),
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE observer_escalations (
    observee_id INT NOT NULL,
    signup_sem VARCHAR(50) NOT NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (observee_id, signup_sem),
    FOREIGN KEY (observee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE deadline_notification_deliveries (
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

CREATE TABLE professors (
    professor_id INT PRIMARY KEY,
    professor_name VARCHAR(100) NOT NULL,
    professor_rank VARCHAR(50),
    professor_department VARCHAR(50),
    last_sem_observed VARCHAR(50),
    FOREIGN KEY (professor_id) REFERENCES users(id)

);

CREATE TABLE courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    department VARCHAR(10) NOT NULL,
    course_number VARCHAR(10) NOT NULL,
    section_number VARCHAR(10) NOT NULL,
    course_name VARCHAR(150) NOT NULL,
    semester VARCHAR(20) NOT NULL,
    course_description TEXT,
    course_day VARCHAR(50), -- can be MW, TR, or single day
    course_start_time VARCHAR(50), -- when the course starts in 24 hour time
    course_end_time VARCHAR(50), -- when the course ends in 24 hour time
    room_number VARCHAR(50),
    prof_id INT NOT NULL, -- might not need this anymore?

    FOREIGN KEY (prof_id) REFERENCES professors(professor_id)
);

-- TODO: add status to observees so we can use it in front end tracking
CREATE TABLE observees (
    observee_id INT,
    hiring_sem VARCHAR(50),
    signup_sem VARCHAR(20),
    signup_course INT,
    -- not_generated: observer list has not been generated for observee
    -- generated: observer list has been generated for observee and is stored in observation request table
    -- no_observers: generated but no observers could observe
    -- approved: observer list has been approved
    -- scheduled: selected observer and has scheduled observation
    -- evaluated: evaluation submitted and signed for that observee
    -- feedback: responsed to feedback survey
    -- manual: observee manually added by AC if needed to fulfill an observation request
    -- TODO: add more as needed
    status ENUM('not_generated','generated','no_observers','approved','scheduled','evaluated','feedback','manual')
        NOT NULL DEFAULT 'not_generated',
    PRIMARY KEY (observee_id, signup_sem),
    FOREIGN KEY (observee_id) REFERENCES professors(professor_id),
    FOREIGN KEY (signup_course) REFERENCES courses(course_id)
);

-- dates an observee offers when signing up (several per sign-up); the observer picks one
CREATE TABLE signup_dates (
    observee_id INT NOT NULL,
    signup_sem VARCHAR(20) NOT NULL,
    offered_date DATE NOT NULL,
    PRIMARY KEY (observee_id, signup_sem, offered_date),
    FOREIGN KEY (observee_id, signup_sem) REFERENCES observees(observee_id, signup_sem)
);

CREATE TABLE course_levels (
    prof_id INT NOT NULL,
    course_level VARCHAR(50) NOT NULL,
    PRIMARY KEY (prof_id, course_level),
    FOREIGN KEY (prof_id) REFERENCES professors(professor_id)
);

-- CREATE TABLE observers (
    -- observer_id INT PRIMARY KEY,
    -- observer_department VARCHAR(100),
    -- FOREIGN KEY (observer_id) REFERENCES professors(professor_id)
-- );

-- CREATE TABLE observer_course_levels (
    -- observer_id INT NOT NULL,
    -- course_level VARCHAR(50) NOT NULL,
    -- PRIMARY KEY (observer_id, course_level),
    -- FOREIGN KEY (observer_id) REFERENCES observers(observer_id)
-- );

CREATE TABLE assessment_committee (
    ac_id INT PRIMARY KEY,
    FOREIGN KEY (ac_id) REFERENCES professors(professor_id)
);

CREATE TABLE meetings (
    meeting_id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_date DATE, -- NULL until the observee confirms an observer (the date that observer picked)

    course_id INT NOT NULL,
    -- department VARCHAR(10) NOT NULL,
    -- course_number VARCHAR(10) NOT NULL,
    -- section_number VARCHAR(10) NOT NULL,
    -- semester VARCHAR(20) NOT NULL,

    observer_id INT, -- NULL until the observee confirms an observer
    ac_id INT,

    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    -- observers come from the same pool as observees (everyone who signed up for the cycle),
    -- so observer_id refers to observees(observee_id) instead of a separate observers table
    FOREIGN KEY (observer_id) REFERENCES observees(observee_id),
    FOREIGN KEY (ac_id) REFERENCES assessment_committee(ac_id)
);

-- one row per observer being asked to observe a meeting
CREATE TABLE observation_requests (
    meeting_id INT NOT NULL,
    observer_id INT NOT NULL,
    -- generated    System generated this person as a potential observer
    -- approved     AC approved this observer, the observee has not sent the request yet
    -- pending      request sent, waiting for the observer (48 hours from sent_at)
    -- accepted     observer accepted and picked a date (selected_date)
    -- declined     observer declined
    -- confirmed    observee chose this observer (meetings.observer_id and meeting_date are set)
    -- not_selected observee chose a different observer
    -- expired      no answer within 48 hours
    status ENUM('generated','approved', 'pending', 'accepted', 'declined', 'confirmed', 'not_selected', 'expired')
        NOT NULL DEFAULT 'approved',
    selected_date DATE, -- one of the observee's offered dates (signup_dates), set when accepting
    sent_at DATETIME,
    responded_at DATETIME,
    PRIMARY KEY (meeting_id, observer_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id),
    FOREIGN KEY (observer_id) REFERENCES observees(observee_id)
);

-- WARN: I think this is not needed anymore
-- CREATE TABLE reports (
--     meeting_id INT PRIMARY KEY,

--     content_clarity INT NOT NULL CHECK (content_clarity BETWEEN 1 AND 5),
--     student_engagement INT NOT NULL CHECK (student_engagement BETWEEN 1 AND 5),
--     openness_to_questions INT NOT NULL CHECK (openness_to_questions BETWEEN 1 AND 5),
--     overall_comments TEXT,
--     tech_use INT NOT NULL CHECK (tech_use BETWEEN 1 AND 5),
--     slide_readability INT NOT NULL CHECK (slide_readability BETWEEN 1 AND 5),
--     lecture_pace INT NOT NULL CHECK (lecture_pace BETWEEN 1 AND 5),

--     FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
-- );


CREATE TABLE evaluation_form_versions (
    version_id INT AUTO_INCREMENT PRIMARY KEY,
    version_number INT NOT NULL,
    version_status ENUM('draft', 'published', 'retired')
        NOT NULL DEFAULT 'draft',
    effective_semester VARCHAR(20),
    created_by INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL DEFAULT NULL,

    UNIQUE (version_number),
    FOREIGN KEY (created_by)
        REFERENCES assessment_committee(ac_id)
);


CREATE TABLE form_questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    version_id INT NOT NULL,
    question_key VARCHAR(100) NOT NULL,
    question_name VARCHAR(255) NOT NULL,
    question_description TEXT,
    question_type ENUM(
        'rating',
        'yes_no',
        'short_answer',
        'long_answer'
    ) NOT NULL,
    question_weight DECIMAL(6,2),
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL,

    UNIQUE (version_id, question_key),
    UNIQUE (version_id, question_id),

    CHECK (question_weight IS NULL OR question_weight >= 0),
    CHECK (display_order >= 0),

    FOREIGN KEY (version_id)
        REFERENCES evaluation_form_versions(version_id)
);

-- DONT THINK WE NEED THIS SINCE WE DON"T NEED OPTIONS.
-- CREATE TABLE form_question_options (
--     option_id INT AUTO_INCREMENT PRIMARY KEY,
--     question_id INT NOT NULL,
--     option_value INT NOT NULL,
--     option_label VARCHAR(150) NOT NULL,
--     display_order INT NOT NULL,

--     UNIQUE (question_id, option_value),

--     CHECK (display_order >= 0),

--     FOREIGN KEY (question_id)
--         REFERENCES form_questions(question_id)
-- );


CREATE TABLE evaluations (
    evaluation_id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL UNIQUE,
    version_id INT NOT NULL,
    evaluation_status ENUM('draft', 'submitted')
        NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL DEFAULT NULL,

    UNIQUE (evaluation_id, version_id),

    FOREIGN KEY (meeting_id)
        REFERENCES meetings(meeting_id),
    FOREIGN KEY (version_id)
        REFERENCES evaluation_form_versions(version_id)
);


CREATE TABLE evaluation_answers (
    evaluation_id INT NOT NULL,
    version_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_number DECIMAL(10,2),
    answer_text TEXT,

    PRIMARY KEY (evaluation_id, question_id),

    FOREIGN KEY (evaluation_id, version_id)
        REFERENCES evaluations(evaluation_id, version_id),
    FOREIGN KEY (version_id, question_id)
        REFERENCES form_questions(version_id, question_id),

    CHECK (
        (answer_number IS NOT NULL AND answer_text IS NULL)
        OR
        (answer_number IS NULL AND answer_text IS NOT NULL)
    )
);
CREATE TABLE evaluation_cycles (
    semester VARCHAR(20) PRIMARY KEY,
    -- is in draft mode until it reaches the signup deadline (once signup deadline passes, can't be changed?)
    cycle_status ENUM('draft', 'signup', 'observation', 'feedback', 'closed')
        NOT NULL DEFAULT 'draft',
    signup_deadline DATETIME NOT NULL,
    observation_deadline DATETIME NOT NULL,
    feedback_deadline DATETIME NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE feedback (
    semester VARCHAR(20),
    professor_id INT,
    semester_role ENUM('observee', 'observer', 'both') NOT NULL DEFAULT 'observee',
    -- asking if the process went OK
    process_OK ENUM('yes', 'mostly', 'no') NOT NULL,
    difficulties TEXT,
    improvements TEXT,
    PRIMARY KEY (semester, professor_id),
    FOREIGN KEY (professor_id) REFERENCES professors(professor_id)
);
