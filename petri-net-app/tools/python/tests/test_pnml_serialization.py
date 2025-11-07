import sys
from pathlib import Path
import unittest


PROJECT_SRC = Path(__file__).resolve().parents[3]
if str(PROJECT_SRC) not in sys.path:
    sys.path.insert(0, str(PROJECT_SRC))


try:  # pragma: no cover - graceful degradation when lxml is absent
    from utils.python.pnml import json_to_pnml, pnml_to_json  # noqa: E402
    LXML_AVAILABLE = True
except ModuleNotFoundError:
    json_to_pnml = None
    pnml_to_json = None
    LXML_AVAILABLE = False


@unittest.skipUnless(LXML_AVAILABLE, "lxml is required for PNML serialization tests")
class PnmlSerializationTest(unittest.TestCase):
    def test_round_trip_preserves_basic_fields(self):
        petri_json = {
            "places": [
                {"id": "p1", "name": "Start", "x": 100, "y": 150, "tokens": 2},
            ],
            "transitions": [
                {"id": "t1", "name": "Go", "x": 220, "y": 150},
            ],
            "arcs": [
                {
                    "id": "a1",
                    "source": "p1",
                    "target": "t1",
                    "sourceDirection": "north",
                    "targetDirection": "south",
                    "weight": 3,
                },
            ],
        }

        pnml = json_to_pnml(petri_json)
        self.assertIn("<place id=\"p1\"", pnml)
        self.assertIn("<transition id=\"t1\"", pnml)
        self.assertIn("<arc id=\"a1\"", pnml)

        parsed = pnml_to_json(pnml)

        self.assertEqual(len(parsed["places"]), 1)
        self.assertEqual(len(parsed["transitions"]), 1)
        self.assertEqual(len(parsed["arcs"]), 1)

        place = parsed["places"][0]
        self.assertEqual(place["id"], "p1")
        self.assertEqual(place["tokens"], 2)

        arc = parsed["arcs"][0]
        self.assertEqual(arc["weight"], 3)
        self.assertEqual(arc["type"], "place-to-transition")

    def test_missing_tokens_defaults_to_zero(self):
        petri_json = {
            "places": [{"id": "p1", "x": 0, "y": 0}],
            "transitions": [],
            "arcs": [],
        }

        pnml = json_to_pnml(petri_json)
        parsed = pnml_to_json(pnml)

        self.assertEqual(parsed["places"][0]["tokens"], 0)


if __name__ == "__main__":
    unittest.main()


