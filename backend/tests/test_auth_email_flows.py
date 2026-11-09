import unittest
from unittest.mock import MagicMock, patch

from flask import Flask
from werkzeug.security import generate_password_hash

import auth


class AuthEmailFlowTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(auth.auth_bp)
        self.client = app.test_client()

    @patch("auth.query")
    def test_login_rejects_unverified_email(self, mock_query):
        mock_query.return_value = [
            {
                "id": 12,
                "password_hash": generate_password_hash("valid-password"),
                "email_verified_at": None,
            }
        ]

        response = self.client.post(
            "/api/auth/login",
            json={"email": "new@example.com", "password": "valid-password"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("Verify your email", response.get_json()["error"])
        mock_query.assert_called_once()

    @patch("auth._send_password_link")
    @patch("auth._issue_password_token", return_value="one-time-token")
    @patch("auth.query")
    def test_forgot_password_sends_activation_link_to_unverified_account(
        self, mock_query, mock_issue_token, mock_send_link
    ):
        mock_query.return_value = [
            {
                "id": 12,
                "password_hash": None,
                "email_verified_at": None,
            }
        ]

        response = self.client.post(
            "/api/auth/forgot-password",
            json={"email": "new@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        mock_issue_token.assert_called_once_with(12, "set_password", 1)
        mock_send_link.assert_called_once_with(
            "new@example.com", "one-time-token", "set_password", 1
        )

    @patch("auth._send_password_link")
    @patch("auth._issue_password_token", return_value="one-time-token")
    @patch("auth.query")
    def test_forgot_password_sends_reset_link_to_verified_account(
        self, mock_query, mock_issue_token, mock_send_link
    ):
        mock_query.return_value = [
            {
                "id": 12,
                "password_hash": "existing-hash",
                "email_verified_at": "2026-01-01 00:00:00",
            }
        ]

        response = self.client.post(
            "/api/auth/forgot-password",
            json={"email": "existing@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        mock_issue_token.assert_called_once_with(12, "reset_password", 1)
        mock_send_link.assert_called_once_with(
            "existing@example.com", "one-time-token", "reset_password", 1
        )

    @patch("auth.transaction")
    @patch("auth.generate_password_hash", return_value="stored-hash")
    @patch("auth.query")
    def test_set_password_token_verifies_email(
        self, mock_query, _mock_hash, mock_transaction
    ):
        mock_query.return_value = [
            {
                "token_id": 7,
                "user_id": 12,
                "purpose": "set_password",
                "password_hash": None,
                "email_verified_at": None,
            }
        ]
        cursor = MagicMock()
        cursor.rowcount = 1
        mock_transaction.return_value.__enter__.return_value = cursor

        response = self.client.post(
            "/api/auth/reset-password",
            json={"token": "one-time-token", "newPassword": "new-password"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["purpose"], "set_password")
        self.assertEqual(
            response.get_json()["message"],
            "Email verified and password set",
        )
        user_update = cursor.execute.call_args_list[1]
        self.assertIn("email_verified_at = NOW()", user_update.args[0])

    @patch("auth.transaction")
    @patch("auth.generate_password_hash", return_value="stored-hash")
    @patch("auth.query")
    def test_reset_password_token_does_not_change_verification(
        self, mock_query, _mock_hash, mock_transaction
    ):
        mock_query.return_value = [
            {
                "token_id": 8,
                "user_id": 12,
                "purpose": "reset_password",
                "password_hash": "existing-hash",
                "email_verified_at": "2026-01-01 00:00:00",
            }
        ]
        cursor = MagicMock()
        cursor.rowcount = 1
        mock_transaction.return_value.__enter__.return_value = cursor

        response = self.client.post(
            "/api/auth/reset-password",
            json={"token": "reset-token", "newPassword": "new-password"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["purpose"], "reset_password")
        user_update = cursor.execute.call_args_list[1]
        self.assertNotIn("email_verified_at", user_update.args[0])


if __name__ == "__main__":
    unittest.main()
