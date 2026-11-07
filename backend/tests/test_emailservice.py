import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from emailservice import EmailServiceError, send_email


class SendEmailTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "EMAILJS_SERVICE_ID": "service",
            "EMAILJS_TEMPLATE_ID": "template",
            "EMAILJS_PUBLIC_KEY": "public",
        },
        clear=True,
    )
    @patch("emailservice.urlopen")
    def test_sends_template_request(self, mock_urlopen):
        response = MagicMock()
        response.status = 200
        mock_urlopen.return_value.__enter__.return_value = response

        send_email("faculty@example.com", "Please sign up", to_name="Faculty")

        request = mock_urlopen.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(payload["service_id"], "service")
        self.assertEqual(payload["template_id"], "template")
        self.assertEqual(payload["user_id"], "public")
        self.assertEqual(
            payload["template_params"],
            {
                "to_email": "faculty@example.com",
                "to_name": "Faculty",
                "message": "Please sign up",
            },
        )
        self.assertEqual(request.get_header("Origin"), "http://localhost:5173")
        self.assertEqual(request.get_header("Referer"), "http://localhost:5173/")
        self.assertIn("Mozilla/5.0", request.get_header("User-agent"))
        self.assertEqual(
            mock_urlopen.call_args.kwargs["timeout"],
            15,
        )

    @patch.dict(
        os.environ,
        {
            "EMAILJS_SERVICE_ID": "service",
            "EMAILJS_TEMPLATE_ID": "template",
            "EMAILJS_PUBLIC_KEY": "public",
            "FRONTEND_URL": "https://assessment.example.com/",
        },
        clear=True,
    )
    @patch("emailservice.urlopen")
    def test_uses_configured_frontend_origin(self, mock_urlopen):
        response = MagicMock()
        response.status = 200
        mock_urlopen.return_value.__enter__.return_value = response

        send_email("faculty@example.com", "Please sign up")

        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.get_header("Origin"), "https://assessment.example.com")
        self.assertEqual(request.get_header("Referer"), "https://assessment.example.com/")

    @patch.dict(os.environ, {}, clear=True)
    def test_missing_configuration_raises_clear_error(self):
        with self.assertRaisesRegex(
            EmailServiceError,
            "EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY",
        ):
            send_email("faculty@example.com", "Please sign up")

    @patch.dict(
        os.environ,
        {
            "EMAILJS_SERVICE_ID": "service",
            "EMAILJS_TEMPLATE_ID": "template",
            "EMAILJS_PUBLIC_KEY": "public",
        },
        clear=True,
    )
    @patch("emailservice.urlopen")
    def test_http_errors_are_reported(self, mock_urlopen):
        mock_urlopen.side_effect = HTTPError(
            "https://api.emailjs.com",
            401,
            "Unauthorized",
            {},
            io.BytesIO(),
        )

        with self.assertRaisesRegex(EmailServiceError, "HTTP status 401"):
            send_email("faculty@example.com", "Please sign up")


if __name__ == "__main__":
    unittest.main()
