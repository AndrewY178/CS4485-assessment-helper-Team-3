CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL, -- if NULL: account created by AC, password not set yet (login refused)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE professors (
    professor_id INT PRIMARY KEY,
    professor_name VARCHAR(100) NOT NULL,
    professor_rank VARCHAR(50),
    FOREIGN KEY (professor_id) REFERENCES users(id)

);

CREATE TABLE observees (
    observee_id INT PRIMARY KEY,
    observee_department VARCHAR(100),
    last_sem_observed VARCHAR(50),
    hiring_sem VARCHAR(50),
    FOREIGN KEY (observee_id) REFERENCES professors(professor_id)
);

CREATE TABLE course_levels (
    prof_id INT NOT NULL,
    course_level VARCHAR(50) NOT NULL,
    PRIMARY KEY (prof_id, course_level),
    FOREIGN KEY (prof_id) REFERENCES professors(professor_id)
);

CREATE TABLE observers (
    observer_id INT PRIMARY KEY,
    observer_department VARCHAR(100),
    FOREIGN KEY (observer_id) REFERENCES professors(professor_id)
);

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

CREATE TABLE courses (
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
    observee_id INT NOT NULL,

    PRIMARY KEY (department, course_number, section_number, semester),
    FOREIGN KEY (observee_id) REFERENCES observees(observee_id)
);

CREATE TABLE meetings (
    meeting_id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_date DATE NOT NULL,

    department VARCHAR(10) NOT NULL,
    course_number VARCHAR(10) NOT NULL,
    section_number VARCHAR(10) NOT NULL,
    semester VARCHAR(20) NOT NULL,

    observer_id INT NOT NULL,
    ac_id INT,

    FOREIGN KEY (department, course_number, section_number, semester)
        REFERENCES courses(department, course_number, section_number, semester),

    FOREIGN KEY (observer_id) REFERENCES observers(observer_id),
    FOREIGN KEY (ac_id) REFERENCES assessment_committee(ac_id)
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
