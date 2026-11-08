import os
import unittest
from unittest.mock import patch

from flask import Flask

import auth
import reminders


class ReminderCandidateTests(unittest.TestCase):
    @patch("reminders.query")
    def test_selects_incomplete_current_and_previous_cycles_once_per_faculty(
        self, mock_query
    ):
        mock_query.side_effect = [
            [
                {"signup_sem": "Fall 2026"},
                {"signup_sem": "Spring 2026"},
            ],
            [{"Field": "meeting_id"}, {"Field": "course_id"}],
            [
                {
                    "user_id": 1,
                    "name": "Alex Faculty",
                    "email": "alex@example.com",
                    "signup_sem": "Fall 2026",
                },
                {
                    "user_id": 1,
                    "name": "Alex Faculty",
                    "email": "alex@example.com",
                    "signup_sem": "Spring 2026",
                },
                {
                    "user_id": 2,
                    "name": "Bri Faculty",
                    "email": "bri@example.com",
                    "signup_sem": "Fall 2026",
                },
            ],
        ]

        candidates = reminders._reminder_candidates()

        self.assertEqual(len(candidates), 2)
        self.assertEqual(candidates[0]["status"], "Overdue")
        self.assertEqual(candidates[0]["cycle"], "Spring 2026")
        self.assertEqual(candidates[1]["status"], "Due")
        candidate_query = mock_query.call_args.args[0]
        self.assertIn("m.course_id = c.course_id", candidate_query)
        self.assertIn("JOIN reports r", candidate_query)

    @patch("reminders.query")
    def test_supports_legacy_meeting_course_columns(self, mock_query):
        mock_query.side_effect = [
            [{"signup_sem": "Fall 2026"}],
            [
                {"Field": "meeting_id"},
                {"Field": "semester"},
                {"Field": "department"},
                {"Field": "course_number"},
                {"Field": "section_number"},
            ],
            [],
        ]

        self.assertEqual(reminders._reminder_candidates(), [])
        candidate_query = mock_query.call_args.args[0]
        self.assertIn("m.semester = c.semester", candidate_query)
        self.assertIn("m.course_number = c.course_number", candidate_query)


class SendRemindersTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(reminders.reminders_bp)
        self.client = app.test_client()

    @patch("reminders.time.sleep")
    @patch("reminders.send_email")
    @patch("reminders._reminder_candidates")
    @patch("auth._roles_for", return_value=["AC Member"])
    @patch("auth._current_session", return_value={"session_id": 3, "user_id": 8})
    @patch.dict(
        os.environ,
        {
            "REMINDER_TEST_MODE": "true",
            "EMAILJS_TEST_RECIPIENT": "test-inbox@example.com",
            "FRONTEND_URL": "http://localhost:5173",
        },
        clear=True,
    )
    def test_sends_separate_personalized_test_emails(
        self,
        _mock_session,
        _mock_roles,
        mock_candidates,
        mock_send_email,
        mock_sleep,
    ):
        mock_candidates.return_value = [
            {
                "user_id": 10,
                "name": "Alex Faculty",
                "email": "alex@example.com",
                "cycle": "Fall 2026",
                "status": "Due",
            },
            {
                "user_id": 11,
                "name": "Bri Faculty",
                "email": "bri@example.com",
                "cycle": "Spring 2026",
                "status": "Overdue",
            },
        ]

        response = self.client.post(
            "/api/reminders",
            headers={"Authorization": "Bearer valid-session-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {"sentCount": 2, "recipientCount": 2, "testMode": True},
        )
        self.assertEqual(mock_send_email.call_count, 2)
        self.assertEqual(
            [call.args[0] for call in mock_send_email.call_args_list],
            ["test-inbox@example.com", "test-inbox@example.com"],
        )
        messages = [call.args[1] for call in mock_send_email.call_args_list]
        self.assertIn("Hello Alex Faculty", messages[0])
        self.assertIn("evaluation for Fall 2026 is due", messages[0])
        self.assertIn("Hello Bri Faculty", messages[1])
        self.assertIn("evaluation for Spring 2026 is overdue", messages[1])
        self.assertNotEqual(messages[0], messages[1])
        mock_sleep.assert_called_once_with(reminders.EMAILJS_RATE_LIMIT_SECONDS)

    @patch("reminders._reminder_candidates", return_value=[])
    @patch("auth._roles_for", return_value=["AC Member"])
    @patch("auth._current_session", return_value={"session_id": 3, "user_id": 8})
    def test_returns_success_when_there_are_no_recipients(
        self, _mock_session, _mock_roles, _mock_candidates
    ):
        response = self.client.post(
            "/api/reminders",
            headers={"Authorization": "Bearer valid-session-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {"sentCount": 0, "recipientCount": 0, "testMode": False},
        )

    @patch("reminders._reminder_candidates")
    @patch("auth._roles_for", return_value=["Faculty"])
    @patch("auth._current_session", return_value={"session_id": 3, "user_id": 8})
    def test_non_ac_member_cannot_send_reminders(
        self, _mock_session, _mock_roles, mock_candidates
    ):
        response = self.client.post(
            "/api/reminders",
            headers={"Authorization": "Bearer valid-session-token"},
        )

        self.assertEqual(response.status_code, 403)
        mock_candidates.assert_not_called()


if __name__ == "__main__":
    unittest.main()
