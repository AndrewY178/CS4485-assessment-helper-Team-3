import unittest

import evaluations


class FakeCursor:
    def __init__(self, questions):
        self.questions = questions

    def execute(self, _sql, _params=None):
        pass

    def fetchall(self):
        return self.questions


class EvaluationAnswerValidationTests(unittest.TestCase):
    def setUp(self):
        self.cursor = FakeCursor([
            {"question_id": 1, "question_type": "rating", "is_required": 1},
            {"question_id": 2, "question_type": "yes_no", "is_required": 1},
            {"question_id": 3, "question_type": "short_answer", "is_required": 0},
            {"question_id": 4, "question_type": "long_answer", "is_required": 0},
        ])

    def test_accepts_supported_answer_types_and_not_applicable(self):
        answers, error = evaluations._validate_answers(
            self.cursor,
            9,
            {"1": "N/A", "2": "yes", "3": "Brief", "4": "Long response"},
            require_required=True,
        )

        self.assertIsNone(error)
        self.assertEqual(answers, [
            (1, None, "N/A"),
            (2, None, "yes"),
            (3, None, "Brief"),
            (4, None, "Long response"),
        ])

    def test_rejects_rating_outside_scale(self):
        answers, error = evaluations._validate_answers(self.cursor, 9, {"1": 6})

        self.assertIsNone(answers)
        self.assertIn("rating from 1 to 5", error)

    def test_rejects_fractional_rating(self):
        answers, error = evaluations._validate_answers(self.cursor, 9, {"1": 3.5})

        self.assertIsNone(answers)
        self.assertIn("rating from 1 to 5", error)

    def test_requires_required_questions_before_observer_signature(self):
        answers, error = evaluations._validate_answers(
            self.cursor,
            9,
            {"1": 4},
            require_required=True,
        )

        self.assertIsNone(answers)
        self.assertIn("required question 2", error)

    def test_rejects_question_from_another_template_version(self):
        answers, error = evaluations._validate_answers(self.cursor, 9, {"99": "value"})

        self.assertIsNone(answers)
        self.assertIn("does not belong", error)


if __name__ == "__main__":
    unittest.main()
