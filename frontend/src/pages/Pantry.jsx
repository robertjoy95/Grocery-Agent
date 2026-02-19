import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function Pantry() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const data = await api("/ingredients");
      setItems(data);
    } catch {
      /* empty */
    }
  }

  async function addItem(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const item = await api("/ingredients", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          quantity: quantity.trim() || null,
          unit: unit.trim() || null,
          category: category.trim() || null,
        }),
      });
      setItems((prev) => [...prev, item]);
      setName("");
      setQuantity("");
      setUnit("");
      setCategory("");
    } catch {
      /* empty */
    }
  }

  async function deleteItem(id) {
    try {
      await api(`/ingredients/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      /* empty */
    }
  }

  const grouped = items.reduce((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="page-container">
      <h1>Pantry</h1>

      <form className="add-row" onSubmit={addItem}>
        <input
          type="text"
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={{ maxWidth: 60 }}
        />
        <input
          type="text"
          placeholder="Unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          style={{ maxWidth: 70 }}
        />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ maxWidth: 100 }}
        />
        <button className="btn btn-primary btn-small" type="submit">
          Add
        </button>
      </form>

      {items.length === 0 && (
        <div className="empty-state">
          Your pantry is empty. Add items above or tell the AI what you have!
        </div>
      )}

      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cat, catItems]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              {cat}
            </div>
            {catItems.map((item) => (
              <div className="pantry-item" key={item.id}>
                <div className="pantry-item-info">
                  <span className="pantry-item-name">{item.name}</span>
                  {(item.quantity || item.unit) && (
                    <span className="pantry-item-detail">
                      {" "}— {item.quantity} {item.unit}
                    </span>
                  )}
                </div>
                <button className="delete-btn" onClick={() => deleteItem(item.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
