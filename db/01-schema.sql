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
    -- manual: observee manually added by AC if needed to fulfill an observation request
    -- TODO: add more as needed
    status ENUM('not_generated','generated','no_observers','approved','manual')
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

CREATE TABLE reports (
    meeting_id INT PRIMARY KEY,

    content_clarity INT NOT NULL CHECK (content_clarity BETWEEN 1 AND 5),
    student_engagement INT NOT NULL CHECK (student_engagement BETWEEN 1 AND 5),
    openness_to_questions INT NOT NULL CHECK (openness_to_questions BETWEEN 1 AND 5),
    overall_comments TEXT,
    tech_use INT NOT NULL CHECK (tech_use BETWEEN 1 AND 5),
    slide_readability INT NOT NULL CHECK (slide_readability BETWEEN 1 AND 5),
    lecture_pace INT NOT NULL CHECK (lecture_pace BETWEEN 1 AND 5),

    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
);

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