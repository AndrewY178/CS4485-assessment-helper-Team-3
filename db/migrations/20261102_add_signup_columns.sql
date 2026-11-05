-- Non-destructive upgrade for databases created from the previous schema.
-- Back up the database before running this one-time migration.

ALTER TABLE courses
    ADD COLUMN course_id INT NOT NULL AUTO_INCREMENT UNIQUE FIRST,
    ADD COLUMN prof_id INT NULL;

UPDATE courses
SET prof_id = observee_id;

ALTER TABLE courses
    MODIFY COLUMN prof_id INT NOT NULL,
    ADD CONSTRAINT fk_courses_professor
        FOREIGN KEY (prof_id) REFERENCES professors(professor_id);

ALTER TABLE observees
    ADD COLUMN signup_sem VARCHAR(20) NULL,
    ADD COLUMN signup_course INT NULL;

-- The previous schema stored courses by professor. This associates each
-- existing observee with their existing course and semester.
UPDATE observees o
JOIN courses c ON c.observee_id = o.observee_id
SET o.signup_sem = c.semester,
    o.signup_course = c.course_id;

ALTER TABLE observees
    ADD INDEX idx_observees_signup_sem (signup_sem),
    ADD CONSTRAINT fk_observees_signup_course
        FOREIGN KEY (signup_course) REFERENCES courses(course_id);
