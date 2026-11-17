import unittest
from datetime import date
from unittest.mock import patch

import signup_dates

DAYS = {"signup": date(2026, 9, 15), "observation": date(2026, 12, 15), "feedback": date(2026, 12, 20)}


class OutsideCycleWindowTests(unittest.TestCase):
    def check(self, dates, days=DAYS):
        with patch.object(signup_dates, "cycle_days", return_value=days):
            return signup_dates._outside_cycle_window(dates, "Fall 2026")

    def test_dates_inside_the_window_are_allowed(self):
        self.assertIsNone(self.check([date(2026, 9, 16), date(2026, 12, 15)]))

    def test_a_date_on_or_before_the_signup_deadline_is_rejected(self):
        self.assertIn("after the sign-up deadline (Sep 15, 2026)", self.check([date(2026, 9, 15)]))
        self.assertIn("after the sign-up deadline", self.check([date(2026, 10, 1), date(2026, 9, 1)]))

    def test_a_date_after_the_observation_deadline_is_rejected(self):
        self.assertIn("on or before the observation deadline (Dec 15, 2026)", self.check([date(2026, 12, 16)]))

    def test_no_cycle_row_is_not_restricted(self):
        self.assertIsNone(self.check([date(2020, 1, 1)], days=None))

    def test_a_missing_deadline_is_not_checked(self):
        self.assertIsNone(self.check([date(2020, 1, 1)], days=dict(DAYS, signup=None)))


if __name__ == "__main__":
    unittest.main()
