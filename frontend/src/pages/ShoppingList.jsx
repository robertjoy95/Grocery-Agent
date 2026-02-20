import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { buildManualItemPayload, sortUncheckedFirst } from "../utils/shoppingList";

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadShoppingList();
  }, []);

  const orderedItems = useMemo(() => sortUncheckedFirst(items), [items]);

  async function loadShoppingList() {
    try {
      const data = await api("/shopping-list");
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addItem(e) {
    e.preventDefault();
    const payload = buildManualItemPayload({ name, quantity, unit, category });
    if (!payload.name || saving) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/shopping-list/items", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setItems(data.items || []);
      setName("");
      setQuantity("");
      setUnit("");
      setCategory("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleChecked(item) {
    try {
      const data = await api(`/shopping-list/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ checked: !item.checked }),
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(itemId) {
    try {
      const data = await api(`/shopping-list/items/${itemId}`, { method: "DELETE" });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function finishAndAddToPantry() {
    if (finishing || items.length === 0) return;
    setFinishing(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/shopping-list/finish", { method: "POST" });
      setItems([]);
      setMessage(
        `Added ${data.added_to_pantry} checked item(s) to pantry and cleared ${data.cleared_items} list item(s).`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <p className="card-meta">Loading shopping list...</p>
      </div>
    );
  }

  return (
    <div className="page-container shopping-list-page">
      <h1>Shopping List</h1>

      <form className="add-row" onSubmit={addItem}>
        <input
          type="text"
          placeholder="Ingredient name"
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
        <button className="btn btn-primary btn-small" type="submit" disabled={saving}>
          {saving ? "Adding..." : "Add"}
        </button>
      </form>

      {error && <p className="error-msg">{error}</p>}
      {message && <p className="success-msg">{message}</p>}

      {items.length === 0 && (
        <div className="empty-state">
          Your shopping list is empty. Add ingredients manually or ask chat to create one.
        </div>
      )}

      {orderedItems.map((item) => (
        <div className={`shopping-item ${item.checked ? "checked" : ""}`} key={item.id}>
          <label className="shopping-item-main">
            <input
              type="checkbox"
              checked={Boolean(item.checked)}
              onChange={() => toggleChecked(item)}
            />
            <span>
              <span className="shopping-item-name">{item.name}</span>
              {(item.quantity || item.unit || item.category) && (
                <span className="shopping-item-meta">
                  {" "}
                  - {[item.quantity, item.unit, item.category].filter(Boolean).join(" ")}
                </span>
              )}
            </span>
          </label>
          <button className="delete-btn" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>
            x
          </button>
        </div>
      ))}

      <div className="shopping-finish-wrap">
        <button
          className="shopping-finish-btn"
          onClick={finishAndAddToPantry}
          disabled={finishing || items.length === 0}
        >
          {finishing ? "Finishing..." : "Finish and add to pantry"}
        </button>
      </div>
    </div>
  );
}
