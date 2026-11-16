import unittest
from unittest.mock import MagicMock, patch

from flask import Flask

import auth
import notifications


class NotificationHelperTests(unittest.TestCase):
    @patch("notifications.transaction")
    def test_create_notifications_inserts_all_recipients_in_one_transaction(
        self, mock_transaction
    ):
        cursor = MagicMock()
        mock_transaction.return_value.__enter__.return_value = cursor

        count = notifications.create_notifications(
            [12, 13, 12], "Schedule update", "Please check your schedule.", 7
        )

        self.assertEqual(count, 2)
        cursor.executemany.assert_called_once()
        self.assertEqual(
            cursor.executemany.call_args.args[1],
            [
                (12, 7, "Schedule update", "Please check your schedule."),
                (13, 7, "Schedule update", "Please check your schedule."),
            ],
        )


class NotificationEndpointTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(notifications.notifications_bp)
        self.client = app.test_client()

    @patch("notifications.query")
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 42})
    def test_get_returns_only_current_users_undismissed_messages(
        self, _mock_session, mock_query
    ):
        mock_query.return_value = [
            {
                "id": 8,
                "title": "Welcome",
                "message": "Welcome to Assessment Helper.",
                "created_at": "2026-11-07 12:00:00",
                "sender_name": "Assessment Committee",
            }
        ]

        response = self.client.get(
            "/api/notifications",
            headers={"Authorization": "Bearer session-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()), 1)
        self.assertIn("n.recipient_id = %s", mock_query.call_args.args[0])
        self.assertIn("n.dismissed_at IS NULL", mock_query.call_args.args[0])
        self.assertIn(
            "CAST(n.created_at AS CHAR) AS created_at",
            mock_query.call_args.args[0],
        )
        self.assertEqual(mock_query.call_args.args[1], (42,))

    @patch("notifications.query", return_value=[{"unread_count": 3}])
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 42})
    def test_unread_count_is_scoped_to_logged_in_user(self, _mock_session, mock_query):
        response = self.client.get(
            "/api/notifications/unread-count",
            headers={"Authorization": "Bearer test-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"unreadCount": 3})
        self.assertIn("read_at IS NULL", mock_query.call_args.args[0])
        self.assertEqual(mock_query.call_args.args[1], (42,))

    @patch("notifications.query", return_value=None)
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 42})
    def test_mark_read_updates_only_logged_in_users_unread_notifications(
        self, _mock_session, mock_query
    ):
        response = self.client.patch(
            "/api/notifications/read",
            headers={"Authorization": "Bearer test-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["message"], "Notifications marked as read")
        self.assertIn("recipient_id = %s", mock_query.call_args.args[0])
        self.assertIn("read_at IS NULL", mock_query.call_args.args[0])
        self.assertEqual(mock_query.call_args.args[1], (42,))
        self.assertFalse(mock_query.call_args.kwargs["fetch"])

    @patch("notifications.create_notifications", return_value=2)
    @patch(
        "notifications._active_faculty",
        return_value=[
            {"user_id": 12, "name": "Alex Faculty", "email": "alex@example.com"},
            {"user_id": 13, "name": "Bri Faculty", "email": "bri@example.com"},
        ],
    )
    @patch("auth._roles_for", return_value=["AC Member"])
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 7})
    def test_ac_can_send_to_selected_faculty(
        self, _mock_session, _mock_roles, mock_faculty, mock_create
    ):
        response = self.client.post(
            "/api/notifications",
            headers={"Authorization": "Bearer session-token"},
            json={
                "title": "Schedule update",
                "message": "Please review your schedule.",
                "userIds": [12, 13],
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["recipientCount"], 2)
        mock_faculty.assert_called_once_with([12, 13])
        mock_create.assert_called_once_with(
            [12, 13],
            "Schedule update",
            "Please review your schedule.",
            7,
        )

    @patch("notifications.create_notifications", return_value=2)
    @patch(
        "notifications._active_faculty",
        return_value=[
            {"user_id": 12, "name": "Alex Faculty", "email": "alex@example.com"},
            {"user_id": 13, "name": "Bri Faculty", "email": "bri@example.com"},
        ],
    )
    @patch("auth._roles_for", return_value=["AC Member"])
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 7})
    def test_ac_can_send_to_all_faculty(
        self, _mock_session, _mock_roles, mock_faculty, mock_create
    ):
        response = self.client.post(
            "/api/notifications",
            headers={"Authorization": "Bearer session-token"},
            json={
                "title": "Important",
                "message": "Please read.",
                "allFaculty": True,
            },
        )

        self.assertEqual(response.status_code, 201)
        mock_faculty.assert_called_once_with()
        self.assertEqual(mock_create.call_args.args[0], [12, 13])

    @patch("notifications._active_faculty")
    @patch("auth._roles_for", return_value=["Faculty"])
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 42})
    def test_faculty_cannot_send_notifications(
        self, _mock_session, _mock_roles, mock_faculty
    ):
        response = self.client.post(
            "/api/notifications",
            headers={"Authorization": "Bearer session-token"},
            json={
                "title": "Unauthorized",
                "message": "Not allowed.",
                "allFaculty": True,
            },
        )

        self.assertEqual(response.status_code, 403)
        mock_faculty.assert_not_called()

    @patch("notifications.query")
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 42})
    def test_dismiss_hides_owned_notification(self, _mock_session, mock_query):
        mock_query.side_effect = [None, [{"id": 8}]]

        response = self.client.patch(
            "/api/notifications/8/dismiss",
            headers={"Authorization": "Bearer session-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["message"], "Notification dismissed")
        self.assertEqual(mock_query.call_args_list[0].args[1], (8, 42))

    @patch("notifications.query", return_value=None)
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 42})
    def test_dismiss_does_not_expose_another_users_notification(
        self, _mock_session, mock_query
    ):
        mock_query.side_effect = [None, []]

        response = self.client.patch(
            "/api/notifications/8/dismiss",
            headers={"Authorization": "Bearer session-token"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(mock_query.call_args_list[1].args[1], (8, 42))

    @patch("notifications._active_faculty")
    @patch("auth._roles_for", return_value=["AC Member"])
    @patch("auth._current_session", return_value={"session_id": 1, "user_id": 7})
    def test_rejects_empty_message_before_fetching_recipients(
        self, _mock_session, _mock_roles, mock_faculty
    ):
        response = self.client.post(
            "/api/notifications",
            headers={"Authorization": "Bearer session-token"},
            json={"title": "Notice", "message": "   ", "allFaculty": True},
        )

        self.assertEqual(response.status_code, 400)
        mock_faculty.assert_not_called()


if __name__ == "__main__":
    unittest.main()
