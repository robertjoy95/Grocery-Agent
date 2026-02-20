import unittest

from app.services.shopping_list import finalize_shopping_items, normalize_ingredient_name


class ShoppingListServiceTests(unittest.TestCase):
    def test_normalize_ingredient_name(self):
        self.assertEqual(normalize_ingredient_name("  Tomatoes  "), "tomato")
        self.assertEqual(normalize_ingredient_name("Green  Beans"), "green bean")
        self.assertEqual(normalize_ingredient_name(""), "")

    def test_finalize_excludes_pantry_and_dedupes(self):
        existing = [
            {"id": "1", "name": "Milk", "checked": False},
            {"id": "2", "name": "Eggs", "checked": False},
        ]
        pantry = [{"name": "egg"}]
        candidates = [
            {"id": "3", "name": "milk", "quantity": "2", "unit": "cartons"},
            {"id": "4", "name": "Bananas"},
        ]

        finalized, excluded = finalize_shopping_items(existing, pantry, candidates)

        self.assertEqual([item["name"] for item in finalized], ["milk", "Bananas"])
        self.assertEqual(finalized[0]["quantity"], "2")
        self.assertIn("Eggs", excluded)


if __name__ == "__main__":
    unittest.main()
