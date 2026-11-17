-- DEV ONLY: two completed historical evaluations for the shared dev account.
-- This file is loaded after 01-schema.sql, 02-seed.sql, and 03-auth.sql.

SET @dev_id = (SELECT id FROM users WHERE username = 'dev_user');
SET @observer_id = (SELECT id FROM users WHERE username = 'prof_01');

-- Give the dev account two historical courses in separate completed semesters.
INSERT INTO courses (
    department, course_number, section_number, course_name, semester,
    course_description, course_day, course_start_time, course_end_time,
    room_number, prof_id
)
SELECT 'CS', '4390', '001', 'Dev Historical Evaluation - Fall', 'Fall 2025',
       'Historical course for development evaluation records.', 'MW',
       '10:00:00', '11:15:00', 'ECSS 2.410', @dev_id
WHERE @dev_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM courses
      WHERE prof_id = @dev_id AND semester = 'Fall 2025'
        AND course_number = '4390' AND section_number = '001'
  );

INSERT INTO courses (
    department, course_number, section_number, course_name, semester,
    course_description, course_day, course_start_time, course_end_time,
    room_number, prof_id
)
SELECT 'CS', '4390', '002', 'Dev Historical Evaluation - Spring', 'Spring 2026',
       'Historical course for development evaluation records.', 'TR',
       '13:00:00', '14:15:00', 'ECSS 2.410', @dev_id
WHERE @dev_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM courses
      WHERE prof_id = @dev_id AND semester = 'Spring 2026'
        AND course_number = '4390' AND section_number = '002'
  );

INSERT INTO observees (observee_id, hiring_sem, signup_sem, signup_course, status)
SELECT @dev_id, 'Fall 2024', 'Fall 2025', c.course_id, 'evaluated'
FROM courses c
WHERE c.prof_id = @dev_id AND c.semester = 'Fall 2025'
  AND c.course_number = '4390' AND c.section_number = '001'
  AND NOT EXISTS (SELECT 1 FROM observees o WHERE o.observee_id = @dev_id AND o.signup_sem = 'Fall 2025');

INSERT INTO observees (observee_id, hiring_sem, signup_sem, signup_course, status)
SELECT @dev_id, 'Fall 2024', 'Spring 2026', c.course_id, 'evaluated'
FROM courses c
WHERE c.prof_id = @dev_id AND c.semester = 'Spring 2026'
  AND c.course_number = '4390' AND c.section_number = '002'
  AND NOT EXISTS (SELECT 1 FROM observees o WHERE o.observee_id = @dev_id AND o.signup_sem = 'Spring 2026');

-- A small published form version gives both past records a stable question set.
INSERT INTO evaluation_form_versions
    (version_number, version_status, effective_semester, created_by, published_at)
SELECT 9001, 'published', 'Fall 2025', @dev_id, '2025-08-01 00:00:00'
WHERE @dev_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM evaluation_form_versions WHERE version_number = 9001);

SET @historical_version = (SELECT version_id FROM evaluation_form_versions WHERE version_number = 9001);

INSERT INTO form_questions
    (version_id, question_key, question_name, question_description, question_type, question_weight, is_required, display_order)
SELECT @historical_version, 'content_clarity', 'Content clarity', 'How clearly was the material explained?', 'rating', 1.00, TRUE, 1
WHERE @historical_version IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM form_questions WHERE version_id = @historical_version AND question_key = 'content_clarity');

INSERT INTO form_questions
    (version_id, question_key, question_name, question_description, question_type, question_weight, is_required, display_order)
SELECT @historical_version, 'student_engagement', 'Student engagement', 'Were students engaged with the material?', 'rating', 1.00, TRUE, 2
WHERE @historical_version IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM form_questions WHERE version_id = @historical_version AND question_key = 'student_engagement');

INSERT INTO form_questions
    (version_id, question_key, question_name, question_description, question_type, question_weight, is_required, display_order)
SELECT @historical_version, 'strengths', 'Strengths', 'What worked especially well?', 'long_answer', NULL, TRUE, 3
WHERE @historical_version IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM form_questions WHERE version_id = @historical_version AND question_key = 'strengths');

-- Completed meetings are visible to the observer and observee evaluation views.
INSERT INTO meetings (meeting_date, course_id, observer_id)
SELECT '2025-10-15', c.course_id, @observer_id
FROM courses c
WHERE c.prof_id = @dev_id AND c.semester = 'Fall 2025' AND c.course_number = '4390' AND c.section_number = '001'
  AND NOT EXISTS (SELECT 1 FROM meetings m WHERE m.course_id = c.course_id);

INSERT INTO meetings (meeting_date, course_id, observer_id)
SELECT '2026-03-11', c.course_id, @observer_id
FROM courses c
WHERE c.prof_id = @dev_id AND c.semester = 'Spring 2026' AND c.course_number = '4390' AND c.section_number = '002'
  AND NOT EXISTS (SELECT 1 FROM meetings m WHERE m.course_id = c.course_id);

INSERT INTO observation_requests (meeting_id, observer_id, status, selected_date, sent_at, responded_at)
SELECT m.meeting_id, @observer_id, 'confirmed', m.meeting_date, m.meeting_date, m.meeting_date
FROM meetings m JOIN courses c ON c.course_id = m.course_id
WHERE c.prof_id = @dev_id AND c.semester IN ('Fall 2025', 'Spring 2026')
  AND c.course_number = '4390' AND c.section_number IN ('001', '002')
  AND m.observer_id = @observer_id
  AND NOT EXISTS (SELECT 1 FROM observation_requests r WHERE r.meeting_id = m.meeting_id AND r.observer_id = @observer_id);

INSERT INTO evaluations (meeting_id, version_id, evaluation_status, submitted_at,
                         observer_signed_by, observer_signature_name, observer_signed_at,
                         observee_signed_by, observee_signature_name, observee_signed_at,
                         observee_response)
SELECT m.meeting_id, @historical_version, 'submitted', m.meeting_date,
       @observer_id, 'Alice Ableton', m.meeting_date,
       @dev_id, 'DEV', m.meeting_date,
       CASE c.semester
           WHEN 'Fall 2025' THEN 'Thank you for the helpful feedback.'
           ELSE 'I have incorporated these suggestions into my teaching.'
       END
FROM meetings m JOIN courses c ON c.course_id = m.course_id
WHERE c.prof_id = @dev_id AND c.semester IN ('Fall 2025', 'Spring 2026')
  AND c.course_number = '4390' AND c.section_number IN ('001', '002')
  AND m.observer_id = @observer_id
  AND NOT EXISTS (SELECT 1 FROM evaluations e WHERE e.meeting_id = m.meeting_id);

INSERT INTO evaluation_answers (evaluation_id, version_id, question_id, answer_number, answer_text)
SELECT e.evaluation_id, e.version_id, q.question_id,
       CASE q.question_key
           WHEN 'content_clarity' THEN CASE c.semester WHEN 'Fall 2025' THEN 4 ELSE 5 END
           WHEN 'student_engagement' THEN CASE c.semester WHEN 'Fall 2025' THEN 3 ELSE 4 END
           ELSE NULL
       END,
       CASE q.question_key
           WHEN 'strengths' THEN CASE c.semester
               WHEN 'Fall 2025' THEN 'Clear organization and useful examples supported student understanding.'
               ELSE 'Strong pacing and thoughtful answers encouraged student participation.'
           END
           ELSE NULL
       END
FROM evaluations e
JOIN meetings m ON m.meeting_id = e.meeting_id
JOIN courses c ON c.course_id = m.course_id
JOIN form_questions q ON q.version_id = e.version_id
WHERE c.prof_id = @dev_id AND c.semester IN ('Fall 2025', 'Spring 2026')
  AND c.course_number = '4390' AND c.section_number IN ('001', '002')
  AND q.question_key IN ('content_clarity', 'student_engagement', 'strengths')
  AND NOT EXISTS (SELECT 1 FROM evaluation_answers a WHERE a.evaluation_id = e.evaluation_id AND a.question_id = q.question_id);
