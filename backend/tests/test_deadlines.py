import os
import unittest
from datetime import datetime
from unittest.mock import patch

from flask import Flask, g

import deadlines

CYCLE = {
    "signup_deadline": datetime(2026, 9, 15, 23, 59),
    "observation_deadline": datetime(2026, 12, 15, 23, 59),
    "feedback_deadline": datetime(2026, 12, 20, 23, 59),
}
BEFORE_SIGNUP = datetime(2026, 9, 1, 12, 0)
AFTER_SIGNUP = datetime(2026, 10, 1, 12, 0)


class RulesTableTests(unittest.TestCase):
    def test_every_rule_uses_a_real_deadline_and_a_valid_direction(self):
        for action, rules in deadlines.RULES.items():
            self.assertTrue(rules, f"{action} has no conditions")
            for column, when in rules:
                self.assertIn(column, deadlines.DEADLINE_LABELS, f"{action}: unknown deadline {column}")
                self.assertIn(when, ("before", "after"), f"{action}: bad direction {when}")


class CheckDeadlineTests(unittest.TestCase):
    def check(self, rules, now, cycle=CYCLE):
        with patch.dict(deadlines.RULES, {"test_action": rules}), patch.object(
            deadlines, "_cycle", return_value=cycle
        ):
            return deadlines.check_deadline("test_action", "Fall 2026", now=now)

    def test_before_rule_allows_until_the_deadline(self):
        self.assertIsNone(self.check([("signup_deadline", "before")], BEFORE_SIGNUP))

    def test_before_rule_blocks_at_and_after_the_deadline(self):
        rules = [("signup_deadline", "before")]
        self.assertEqual(self.check(rules, AFTER_SIGNUP)["deadline"], "signup_deadline")
        self.assertIsNotNone(self.check(rules, CYCLE["signup_deadline"]))
        self.assertIsNone(self.check(rules, datetime(2026, 9, 15, 23, 58, 59)))

    def test_after_rule_blocks_until_the_deadline_passes(self):
        rules = [("signup_deadline", "after")]
        self.assertEqual(self.check(rules, BEFORE_SIGNUP)["rule"], "after")
        self.assertIsNone(self.check(rules, AFTER_SIGNUP))
        self.assertIsNone(self.check(rules, CYCLE["signup_deadline"]))

    def test_window_between_two_deadlines(self):
        rules = [("signup_deadline", "after"), ("observation_deadline", "before")]
        self.assertIsNotNone(self.check(rules, BEFORE_SIGNUP))
        self.assertIsNone(self.check(rules, AFTER_SIGNUP))
        self.assertIsNotNone(self.check(rules, datetime(2026, 12, 16)))

    def test_no_cycle_row_blocks_nothing(self):
        self.assertIsNone(self.check([("signup_deadline", "before")], AFTER_SIGNUP, cycle=None))

    def test_unset_deadline_blocks_nothing(self):
        cycle = dict(CYCLE, signup_deadline=None)
        self.assertIsNone(self.check([("signup_deadline", "before")], AFTER_SIGNUP, cycle=cycle))

    def test_message_names_the_deadline_and_time(self):
        problem = self.check([("signup_deadline", "before")], AFTER_SIGNUP)
        self.assertIn("Sign-up closed", problem["message"])
        self.assertIn("Sep 15, 2026 at 23:59 UTC", problem["message"])
        self.assertEqual(problem["at"], "2026-09-15T23:59:00Z")

    def test_unknown_action_is_an_error(self):
        with self.assertRaises(ValueError):
            deadlines.check_deadline("no_such_action", "Fall 2026")


class DeadlineBlockTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        patcher = patch.dict(deadlines.RULES, {"test_action": [("signup_deadline", "before")]})
        patcher.start()
        self.addCleanup(patcher.stop)
        patch.object(deadlines, "_cycle", return_value=CYCLE).start()
        patch.object(deadlines, "_utcnow", return_value=AFTER_SIGNUP).start()
        self.addCleanup(patch.stopall)

    def block_as(self, username, env=None):
        with self.app.test_request_context(), patch.dict(os.environ, env or {}):
            g.user_id = 7
            with patch.object(deadlines, "query", return_value=[{"username": username}]):
                return deadlines.deadline_block("test_action", "Fall 2026")

    def test_professor_is_blocked_after_the_deadline(self):
        response, status = self.block_as("prof_01")
        self.assertEqual(status, 403)
        self.assertIn("Sign-up closed", response.get_json()["error"])

    def test_dev_account_bypasses_the_deadline(self):
        self.assertIsNone(self.block_as("dev_user"))

    def test_bypass_list_can_be_changed_or_turned_off(self):
        self.assertIsNone(self.block_as("prof_01", {"DEADLINE_BYPASS_USERNAMES": "prof_01, other"}))
        self.assertIsNotNone(self.block_as("dev_user", {"DEADLINE_BYPASS_USERNAMES": ""}))
        self.assertIsNotNone(self.block_as("dev_user", {"DEADLINE_BYPASS_USERNAMES": "someone_else"}))

    def test_allowed_action_returns_none(self):
        with patch.object(deadlines, "_utcnow", return_value=BEFORE_SIGNUP):
            self.assertIsNone(self.block_as("prof_01"))


if __name__ == "__main__":
    unittest.main()
