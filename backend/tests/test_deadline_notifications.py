import unittest
from datetime import datetime

from deadline_notifications import (
    _deadline_key,
    _notification_text,
    _title,
    _due_reminder_keys,
)


class DeadlineNotificationTests(unittest.TestCase):
    def setUp(self):
        self.deadline = datetime(2026, 12, 15, 17, 0)

    def test_ac_deadline_reminder_cadence(self):
        self.assertEqual(
            _deadline_key(datetime(2026, 12, 8, 17, 0), self.deadline, "signup"),
            "ac_signup_7_days",
        )
        self.assertEqual(
            _deadline_key(datetime(2026, 12, 14, 17, 0), self.deadline, "signup"),
            "ac_signup_1_day",
        )
        self.assertEqual(
            _deadline_key(datetime(2026, 12, 15, 9, 0), self.deadline, "signup"),
            "ac_signup_deadline",
        )
        self.assertIsNone(
            _deadline_key(datetime(2026, 12, 7, 16, 59), self.deadline, "signup")
        )
        self.assertIsNone(
            _deadline_key(datetime(2026, 12, 16, 9, 0), self.deadline, "signup")
        )

    def test_feedback_reminders_include_survey_open_and_due_stage(self):
        observation_deadline = datetime(2026, 12, 1, 17, 0)
        self.assertEqual(
            _due_reminder_keys(
                datetime(2026, 12, 8, 17, 0),
                observation_deadline,
                self.deadline,
            ),
            ["feedback_open", "feedback_7_days"],
        )
        self.assertEqual(
            _due_reminder_keys(
                datetime(2026, 12, 15, 9, 0),
                observation_deadline,
                self.deadline,
            ),
            ["feedback_open", "feedback_deadline"],
        )
        self.assertEqual(
            _due_reminder_keys(
                datetime(2026, 12, 16, 9, 0),
                observation_deadline,
                self.deadline,
            ),
            [],
        )

    def test_ac_deadline_content_names_phase_and_timing(self):
        key = "ac_observation_1_day"
        self.assertEqual(
            _title(key, "Fall 2026"),
            "Observation deadline tomorrow — Fall 2026",
        )
        self.assertEqual(
            _notification_text(key, "Fall 2026"),
            "The observation deadline for Fall 2026 is tomorrow.",
        )


if __name__ == "__main__":
    unittest.main()
