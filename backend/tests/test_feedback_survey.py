import unittest
from datetime import datetime
from unittest.mock import patch

from flask import Flask, g

import deadlines
import feedback

CYCLE = {
    "signup_deadline": datetime(2026, 9, 15),
    "observation_deadline": datetime(2026, 12, 1),
    "feedback_deadline": datetime(2026, 12, 10),
}


def problem_at(now, submitted):
    app = Flask(__name__)
    with app.test_request_context():
        g.user_id = 5
        with patch.object(deadlines, "_cycle", return_value=CYCLE), patch.object(
            deadlines, "_utcnow", return_value=now
        ), patch.object(deadlines, "_is_bypassed", return_value=False), patch.object(
            feedback, "_has_submitted_observation_form", return_value=submitted
        ):
            return feedback.survey_problem("Fall 2026")


class SurveyWindowTests(unittest.TestCase):
    def test_before_observation_deadline_closed_without_a_submitted_form(self):
        problem = problem_at(datetime(2026, 11, 20), submitted=False)
        self.assertEqual(problem["deadline"], "observation_deadline")
        self.assertIn("submit your observation form", problem["message"])

    def test_before_observation_deadline_open_after_submitting_the_form(self):
        self.assertIsNone(problem_at(datetime(2026, 11, 20), submitted=True))

    def test_after_observation_deadline_open_to_everyone(self):
        self.assertIsNone(problem_at(datetime(2026, 12, 5), submitted=False))

    def test_closed_after_feedback_deadline_even_if_submitted(self):
        problem = problem_at(datetime(2026, 12, 11), submitted=True)
        self.assertEqual(problem["deadline"], "feedback_deadline")

    def test_observation_form_is_due_with_the_observation_deadline(self):
        self.assertEqual(deadlines.RULES["complete_evaluation"], [("observation_deadline", "before")])


if __name__ == "__main__":
    unittest.main()
