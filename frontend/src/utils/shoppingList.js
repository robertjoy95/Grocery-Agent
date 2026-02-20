export function buildManualItemPayload({ name, quantity, unit, category }) {
  return {
    name: (name || "").trim(),
    quantity: (quantity || "").trim() || null,
    unit: (unit || "").trim() || null,
    category: (category || "").trim() || null,
  };
}

export function sortUncheckedFirst(items) {
  return [...items].sort((a, b) => Number(a.checked) - Number(b.checked));
}
