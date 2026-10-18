
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE professors (
    professor_id INT PRIMARY KEY,
    professor_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (professor_id) REFERENCES users(id)

);

CREATE TABLE observees (
    observees_id INT PRIMARY KEY,
    observee_rank VARCHAR(50),
    observee_department VARCHAR(100),
    last_sem_observed VARCHAR(50),
    hiring_sem VARCHAR(50),
    FOREIGN KEY (observees_id) REFERENCES professors(professor_id)
);

CREATE TABLE observee_course_levels (
    observees_id INT NOT NULL,
    course_level VARCHAR(50) NOT NULL,
    PRIMARY KEY (observees_id, course_level),
    FOREIGN KEY (observees_id) REFERENCES observees(observees_id)
);

CREATE TABLE observers (
    observer_id INT PRIMARY KEY,
    observer_department VARCHAR(100),
    FOREIGN KEY (observer_id) REFERENCES professors(professor_id)
);

CREATE TABLE observer_course_levels (
    observer_id INT NOT NULL,
    course_level VARCHAR(50) NOT NULL,
    PRIMARY KEY (observer_id, course_level),
    FOREIGN KEY (observer_id) REFERENCES observers(observer_id)
);

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
    course_times VARCHAR(50),
    room_number VARCHAR(50),
    observee_id INT NOT NULL,

    PRIMARY KEY (department, course_number, section_number, semester),
    FOREIGN KEY (observee_id) REFERENCES observees(observees_id)
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

    content_clarity INT CHECK (content_clarity BETWEEN 1 AND 5),
    student_engagement INT CHECK (student_engagement BETWEEN 1 AND 5),
    openness_to_questions INT CHECK (openness_to_questions BETWEEN 1 AND 5),
    overall_comments TEXT,
    tech_use INT CHECK (tech_use BETWEEN 1 AND 5),
    slide_readability INT CHECK (slide_readability BETWEEN 1 AND 5),
    lecture_pace INT CHECK (lecture_pace BETWEEN 1 AND 5),

    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
);
