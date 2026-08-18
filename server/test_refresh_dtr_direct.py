import os
import sys
import unittest
from datetime import timedelta


SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from refresh_dtr_direct import classify_daily_scans


def minutes(value):
    hours, minute = map(int, value.split(":"))
    return timedelta(hours=hours, minutes=minute)


class ClassifyDailyScansTests(unittest.TestCase):
    standard_schedule = tuple(map(minutes, ("08:00", "12:00", "13:00", "17:00")))

    def classify(self, punches, schedule=None):
        return classify_daily_scans(
            [minutes(value) for value in punches],
            schedule or self.standard_schedule,
        )

    def assert_slots(self, actual, expected):
        self.assertEqual(
            actual,
            tuple(minutes(value) if value else None for value in expected),
        )

    def test_missing_am_in_with_clear_lunch_and_afternoon_punches(self):
        self.assert_slots(
            self.classify(("12:01", "13:10", "18:06")),
            (None, "12:01", "13:10", "18:06"),
        )

    def test_ambiguous_lunch_and_single_afternoon_punch_is_unchanged(self):
        self.assert_slots(
            self.classify(("12:01", "18:06")),
            (None, None, "12:01", "18:06"),
        )

    def test_afternoon_only_day_is_unchanged(self):
        self.assert_slots(
            self.classify(("13:10", "18:06")),
            (None, None, "13:10", "18:06"),
        )

    def test_complete_day_is_unchanged(self):
        self.assert_slots(
            self.classify(("08:00", "12:01", "13:10", "18:06")),
            ("08:00", "12:01", "13:10", "18:06"),
        )

    def test_effective_schedule_boundaries_are_used(self):
        custom_schedule = tuple(map(minutes, ("07:30", "11:30", "12:30", "16:30")))
        self.assert_slots(
            self.classify(("11:31", "12:40", "17:30"), custom_schedule),
            (None, "11:31", "12:40", "17:30"),
        )


if __name__ == "__main__":
    unittest.main()
