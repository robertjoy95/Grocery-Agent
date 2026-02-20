import test from "node:test";
import assert from "node:assert/strict";

import { buildManualItemPayload, sortUncheckedFirst } from "../src/utils/shoppingList.js";

test("buildManualItemPayload trims and nulls empty optional fields", () => {
  const payload = buildManualItemPayload({
    name: "  milk  ",
    quantity: "  ",
    unit: " gallon ",
    category: "",
  });

  assert.equal(payload.name, "milk");
  assert.equal(payload.quantity, null);
  assert.equal(payload.unit, "gallon");
  assert.equal(payload.category, null);
});

test("sortUncheckedFirst keeps unchecked before checked", () => {
  const ordered = sortUncheckedFirst([
    { id: "a", checked: true },
    { id: "b", checked: false },
    { id: "c", checked: true },
  ]);

  assert.deepEqual(ordered.map((item) => item.id), ["b", "a", "c"]);
});
