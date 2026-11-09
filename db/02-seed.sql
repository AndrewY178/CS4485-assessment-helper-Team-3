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

-- ---------------------------------------------------------------------------
-- Fake CS professors and courses for development
-- ---------------------------------------------------------------------------

-- Create the user accounts first.
-- NULL passwords intentionally prevent these accounts from logging in.
INSERT INTO users (username, email, password_hash) VALUES
    ('prof_01', 'p01@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_02', 'p02@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_03', 'p03@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_04', 'p04@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_05', 'p05@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_06', 'p06@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_07', 'p07@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_08', 'p08@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_09', 'p09@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_10', 'p10@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636"),
    ('prof_11', 'p11@example.com', "scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636");

-- Add fake display names.
-- The professor_id is the corresponding users.id.
INSERT INTO professors (professor_id, professor_name, professor_rank, professor_department, last_sem_observed)
SELECT
    id,
    CASE username
        WHEN 'prof_01' THEN 'Alice Ableton'
        WHEN 'prof_02' THEN 'Bobby Bobton'
        WHEN 'prof_03' THEN 'Carl Candle'
        WHEN 'prof_04' THEN 'Drew Draw'
        WHEN 'prof_05' THEN 'Edgar Eddingtion'
        WHEN 'prof_06' THEN 'Faust Frost'
        WHEN 'prof_07' THEN 'Gary Gobber'
        WHEN 'prof_08' THEN 'Harry Styles'
        WHEN 'prof_09' THEN 'Inigo Montoya'
        WHEN 'prof_10' THEN 'John Jones'
        WHEN 'prof_11' THEN 'T1 FAKER'
    END,
    CASE username
        WHEN 'prof_01' THEN 'Assistant'
        WHEN 'prof_02' THEN 'Assistant'
        WHEN 'prof_03' THEN 'Assistant'
        WHEN 'prof_04' THEN 'Assistant'
        WHEN 'prof_05' THEN 'Associate'
        WHEN 'prof_06' THEN 'Associate'
        WHEN 'prof_07' THEN 'Associate'
        WHEN 'prof_08' THEN 'Full'
        WHEN 'prof_09' THEN 'Full'
        WHEN 'prof_10' THEN 'Full'
        WHEN 'prof_11' THEN 'Full'
    END,
    'CS',
    NULL
FROM users
WHERE username LIKE 'prof_%';

-- Make each professor an observee.
INSERT INTO observees (
    observee_id, hiring_sem, signup_sem
)
SELECT
    id, 'Fall 2024',
    CASE 
        WHEN username = 'prof_10' THEN 'Spring 2026'
        ELSE 'Fall 2026' 
    END
FROM users
WHERE username LIKE 'prof_%';

-- Add courses and associate each course with a professor.
-- Times use 24-hour format: HH:MM:SS.

INSERT INTO courses (
    department,
    course_number,
    section_number,
    course_name,
    semester,
    course_description,
    course_day,
    course_start_time,
    course_end_time,
    room_number,
    prof_id
)
SELECT
    'CS',
    '1336',
    '001',
    'Programming Fundamentals',
    'Fall 2026',
    'Introduction to programming and problem solving.',
    'MW',
    '10:00:00',
    '11:15:00',
    'SCI 1.230',
    id
FROM users
WHERE username = 'prof_01';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '2336',
    '001',
    'Computer Science II',
    'Fall 2026',
    'Object-oriented programming and data structures.',
    'TR',
    '09:00:00',
    '10:15:00',
    'SCI 1.210',
    id
FROM users
WHERE username = 'prof_02';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '3305',
    '001',
    'Discrete Mathematics for Computing',
    'Fall 2026',
    'Logic, proofs, sets, graphs, and combinatorics.',
    'MW',
    '11:30:00',
    '12:45:00',
    'SCI 2.220',
    id
FROM users
WHERE username = 'prof_03';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '3341',
    '001',
    'Probability and Statistics in Computer Science',
    'Fall 2026',
    'Probability models and statistical methods for computing.',
    'TR',
    '10:30:00',
    '11:45:00',
    'SCI 1.230',
    id
FROM users
WHERE username = 'prof_04';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '3345',
    '001',
    'Data Structures and Advanced Programming',
    'Fall 2026',
    'Advanced data structures and algorithmic techniques.',
    'MW',
    '13:00:00',
    '14:15:00',
    'SCI 1.210',
    id
FROM users
WHERE username = 'prof_05';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '4341',
    '001',
    'Computer Architecture',
    'Fall 2026',
    'Organization and design of modern computer systems.',
    'TR',
    '12:00:00',
    '13:15:00',
    'SCI 2.210',
    id
FROM users
WHERE username = 'prof_06';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '4347',
    '001',
    'Database Systems',
    'Fall 2026',
    'Database design, SQL, indexing, and transactions.',
    'MW',
    '14:30:00',
    '15:45:00',
    'SCI 1.230',
    id
FROM users
WHERE username = 'prof_07';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '4348',
    '001',
    'Operating Systems',
    'Fall 2026',
    'Processes, memory management, filesystems, and concurrency.',
    'TR',
    '13:30:00',
    '14:45:00',
    'SCI 2.220',
    id
FROM users
WHERE username = 'prof_08';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '4384',
    '001',
    'Computer Networks',
    'Fall 2026',
    'Network protocols, routing, and distributed communication.',
    'MW',
    '16:00:00',
    '17:15:00',
    'SCI 1.210',
    id
FROM users
WHERE username = 'prof_09';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS',
    '4485',
    '001',
    'Computer Science Project',
    'Fall 2026',
    'Senior software engineering project course.',
    'TR',
    '15:00:00',
    '16:15:00',
    'SCI 2.210',
    id
FROM users
WHERE username = 'prof_10';

INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT 
    'CS',
    '2026',
    '001',
    'Special Topics in CS',
    'Fall 2026',
    'LEAGUE OF LEGENDS',
    'MW',
    '17:30:00',
    '18:45:00',
    'Korea 1.210',
    id
FROM users
WHERE username = 'prof_11';

-- add the courses the prof wants observed
UPDATE observees o
JOIN courses c
    ON c.prof_id = o.observee_id
SET o.signup_course = c.course_id
WHERE c.prof_id IS NOT NULL;

-- Assign each professor the course level represented by the
-- first digit of the course number.

-- DISTINCT prevents duplicate rows if a professor teaches
-- multiple courses at the same level.
INSERT INTO course_levels (prof_id, course_level)
SELECT DISTINCT
    c.prof_id,
    CONCAT(SUBSTRING(c.course_number, 1, 1), '000')
FROM courses c
WHERE c.department = 'CS';

-- shared dev account (an AC Member + default Faculty role)
-- DEV ONLY: delete this account (and don't run this seed file) before any real deployment
INSERT INTO users (username, email, password_hash) VALUES
  ('dev_user', 'dev@example.com', 'scrypt:32768:8:1$mAGnCIkLHbZBt0Cf$81bf5bbc595b5ec17c727a2b67a1e336992dce42add1bb3f10d39c12af15e77a5b554e9f3623690a1ba23a7bb735c19fe2adf51654b67fd6bb3d88d1dd868636');

UPDATE users
SET email_verified_at = CURRENT_TIMESTAMP
WHERE password_hash IS NOT NULL;

INSERT INTO professors (professor_id, professor_name, professor_department)
  SELECT id, 'DEV', 'CS' FROM users WHERE username = 'dev_user';

INSERT INTO assessment_committee (ac_id)
  SELECT id FROM users WHERE username = 'dev_user';

-- INSERT INTO observers (observer_id)
--   SELECT id FROM users WHERE username = 'dev_user';

INSERT INTO observees (observee_id, signup_sem)
  SELECT id, "Fall 1996"
 FROM users WHERE username = 'dev_user';

-- DEV ONLY: a Fall 2026 course and sign-up for the dev account so the sign-up page and the
-- observer flow can be tried by logging in as dev. 
-- At the end of dev: delete this block (keep the Fall 1996 row above, scenario 2 uses it) and reset the database.
INSERT INTO courses (
    department, course_number, section_number, course_name,
    semester, course_description, course_day,
    course_start_time, course_end_time, room_number, prof_id
)
SELECT
    'CS', '4390', '001', 'Dev Test',
    'Fall 2026', 'Course for dev account', 'MW',
    '10:00:00', '11:15:00', 'ECSS 2.410', id
FROM users
WHERE username = 'dev_user';

INSERT INTO course_levels (prof_id, course_level)
SELECT id, '4000' FROM users WHERE username = 'dev_user';

INSERT INTO observees (observee_id, hiring_sem, signup_sem, signup_course)
SELECT u.id, 'Fall 2024', 'Fall 2026', c.course_id
FROM users u
JOIN courses c ON c.prof_id = u.id AND c.semester = 'Fall 2026'
WHERE u.username = 'dev_user';

-- add meetings for all the professors
INSERT INTO meetings (course_id)
SELECT o.signup_course
FROM observees o
WHERE o.signup_course IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.course_id = o.signup_course
  );
          
-- ---------------------------------------------------------------------------
-- Sample data for the observer request flow (accept / reject)
-- Each scenario is one observee's sign-up at a different stage. The offered dates fall on
-- days that observee's class meets. Pending requests are timed relative to when the
-- database is created, so reset the database (docker compose down -v) to get fresh ones.
-- ---------------------------------------------------------------------------

SET @p03 = (SELECT id FROM users WHERE username = 'prof_03');
SET @p04 = (SELECT id FROM users WHERE username = 'prof_04');
SET @p05 = (SELECT id FROM users WHERE username = 'prof_05');
SET @p06 = (SELECT id FROM users WHERE username = 'prof_06');
SET @p07 = (SELECT id FROM users WHERE username = 'prof_07');
SET @p08 = (SELECT id FROM users WHERE username = 'prof_08');
SET @p09 = (SELECT id FROM users WHERE username = 'prof_09');
SET @dev = (SELECT id FROM users WHERE username = 'dev_user');

-- The meetings for these sign-ups were already created above ("add meetings for all the
-- professors"), so each scenario looks its meeting up instead of inserting a second one.
-- Every scenario's observer list was approved, so those sign-ups are marked 'approved'.
UPDATE observees
SET status = 'approved'
WHERE signup_sem = 'Fall 2026'
  AND observee_id IN (@p03, @p04, @p06, @p07);

-- Scenario 1: AC approved two observers for prof_03, the observee has not sent the requests yet
INSERT INTO signup_dates (observee_id, signup_sem, offered_date) VALUES
    (@p03, 'Fall 2026', '2026-11-16'),
    (@p03, 'Fall 2026', '2026-11-18'),
    (@p03, 'Fall 2026', '2026-11-23');

SET @m1 = (SELECT m.meeting_id FROM meetings m JOIN observees o ON o.signup_course = m.course_id
           WHERE o.observee_id = @p03 AND o.signup_sem = 'Fall 2026');

INSERT INTO observation_requests (meeting_id, observer_id, status) VALUES
    (@m1, @p04, 'approved'),
    (@m1, @p05, 'approved');

-- Scenario 2: prof_04 sent requests an hour ago. prof_03 declined, prof_05 accepted and picked
-- a date, dev_user has not answered yet (once the observer's pending-requests list exists,
-- logging in as dev@example.com should show this request)
INSERT INTO signup_dates (observee_id, signup_sem, offered_date) VALUES
    (@p04, 'Fall 2026', '2026-11-17'),
    (@p04, 'Fall 2026', '2026-11-19'),
    (@p04, 'Fall 2026', '2026-11-24');

SET @m2 = (SELECT m.meeting_id FROM meetings m JOIN observees o ON o.signup_course = m.course_id
           WHERE o.observee_id = @p04 AND o.signup_sem = 'Fall 2026');

INSERT INTO observation_requests (meeting_id, observer_id, status, selected_date, sent_at, responded_at) VALUES
    (@m2, @p03, 'declined', NULL,         NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 30 MINUTE),
    (@m2, @p05, 'accepted', '2026-11-19', NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 20 MINUTE),
    (@m2, @dev, 'pending',  NULL,         NOW() - INTERVAL 1 HOUR, NULL);

-- Scenario 3: prof_06 already confirmed prof_07, so the meeting has its observer and date.
-- prof_08 had also accepted but was not selected, prof_09 declined
INSERT INTO signup_dates (observee_id, signup_sem, offered_date) VALUES
    (@p06, 'Fall 2026', '2026-11-17'),
    (@p06, 'Fall 2026', '2026-11-19'),
    (@p06, 'Fall 2026', '2026-11-24');

SET @m3 = (SELECT m.meeting_id FROM meetings m JOIN observees o ON o.signup_course = m.course_id
           WHERE o.observee_id = @p06 AND o.signup_sem = 'Fall 2026');

UPDATE meetings
SET observer_id = @p07, meeting_date = '2026-11-17'
WHERE meeting_id = @m3;

INSERT INTO observation_requests (meeting_id, observer_id, status, selected_date, sent_at, responded_at) VALUES
    (@m3, @p07, 'confirmed',    '2026-11-17', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 1 DAY),
    (@m3, @p08, 'not_selected', '2026-11-19', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 1 DAY),
    (@m3, @p09, 'declined',     NULL,         NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 1 DAY);

-- Scenario 4: prof_07's request to prof_09 was sent 3 days ago and never answered. It is still
-- 'pending' in the table but is past the 48 hours, so the app should treat it as expired
INSERT INTO signup_dates (observee_id, signup_sem, offered_date) VALUES
    (@p07, 'Fall 2026', '2026-11-16'),
    (@p07, 'Fall 2026', '2026-11-18');

SET @m4 = (SELECT m.meeting_id FROM meetings m JOIN observees o ON o.signup_course = m.course_id
           WHERE o.observee_id = @p07 AND o.signup_sem = 'Fall 2026');

INSERT INTO observation_requests (meeting_id, observer_id, status, sent_at) VALUES
    (@m4, @p09, 'pending', NOW() - INTERVAL 3 DAY);
