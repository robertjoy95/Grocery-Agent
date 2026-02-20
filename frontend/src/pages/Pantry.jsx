import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";

export default function Pantry() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [scannedIngredients, setScannedIngredients] = useState([]);
  const [bulkAdding, setBulkAdding] = useState(false);
  const uploadPhotoInputRef = useRef(null);
  const cameraPhotoInputRef = useRef(null);

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
    const payload = {
      name: name.trim(),
      quantity: quantity.trim() || null,
      unit: unit.trim() || null,
      category: category.trim() || null,
    };
    try {
      const item = await createIngredient(payload);
      setItems((prev) => [...prev, item]);
      setName("");
      setQuantity("");
      setUnit("");
      setCategory("");
    } catch {
      /* empty */
    }
  }

  async function createIngredient(payload) {
    return api("/ingredients", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  function openImportFromPhoto() {
    setImportOpen(true);
    setPhotoFile(null);
    setPhotoError("");
    setScannedIngredients([]);
  }

  function closeImportFromPhoto() {
    setImportOpen(false);
    setPhotoFile(null);
    setPhotoLoading(false);
    setPhotoError("");
    setScannedIngredients([]);
  }

  function onPhotoSelected(e) {
    const selected = e.target.files?.[0] || null;
    setPhotoFile(selected);
    setPhotoError("");
    setScannedIngredients([]);
  }

  async function scanPhotoForIngredients() {
    if (!photoFile) return;
    setPhotoLoading(true);
    setPhotoError("");
    setScannedIngredients([]);
    try {
      const form = new FormData();
      form.append("photo", photoFile);
      const data = await api("/ingredients/scan-photo", {
        method: "POST",
        body: form,
      });
      setScannedIngredients(data.ingredients || []);
      if (!data.ingredients || data.ingredients.length === 0) {
        setPhotoError("No ingredients were detected in that photo.");
      }
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoLoading(false);
    }
  }

  async function addScannedIngredient(index) {
    const target = scannedIngredients[index];
    if (!target) return;
    try {
      const created = await createIngredient({
        name: (target.name || "").trim(),
        quantity: (target.quantity || "").trim() || null,
        unit: (target.unit || "").trim() || null,
        category: (target.category || "").trim() || null,
      });
      setItems((prev) => [...prev, created]);
      setScannedIngredients((prev) => prev.filter((_, i) => i !== index));
    } catch (err) {
      setPhotoError(err.message);
    }
  }

  function removeScannedIngredient(index) {
    setScannedIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  async function addAllScannedIngredients() {
    if (scannedIngredients.length === 0 || bulkAdding) return;
    setBulkAdding(true);
    setPhotoError("");
    try {
      const createdItems = [];
      for (const candidate of scannedIngredients) {
        const created = await createIngredient({
          name: (candidate.name || "").trim(),
          quantity: (candidate.quantity || "").trim() || null,
          unit: (candidate.unit || "").trim() || null,
          category: (candidate.category || "").trim() || null,
        });
        createdItems.push(created);
      }
      setItems((prev) => [...prev, ...createdItems]);
      closeImportFromPhoto();
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setBulkAdding(false);
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

      <div className="pantry-fab-wrap">
        <button className="pantry-fab" onClick={openImportFromPhoto}>
          Import from photo
        </button>
      </div>

      {importOpen && (
        <div className="recipe-overlay" onClick={closeImportFromPhoto}>
          <div className="recipe-sheet" onClick={(e) => e.stopPropagation()}>
            <button
              className="recipe-close-btn"
              onClick={closeImportFromPhoto}
              aria-label="Close pantry import modal"
            >
              ×
            </button>

            <div className="recipe-mode-panel">
              <h2>Import ingredients from photo</h2>
              <p className="card-meta" style={{ marginBottom: 12 }}>
                Take a new photo or upload one from your device.
              </p>
              <div className="card-actions" style={{ marginBottom: 12 }}>
                <button
                  className="btn btn-primary btn-small"
                  type="button"
                  onClick={() => uploadPhotoInputRef.current?.click()}
                >
                  Upload Photo
                </button>
                <button
                  className="btn btn-primary btn-small"
                  type="button"
                  onClick={() => cameraPhotoInputRef.current?.click()}
                >
                  Take Photo
                </button>
              </div>
              <input
                ref={uploadPhotoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onPhotoSelected}
              />
              <input
                ref={cameraPhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={onPhotoSelected}
              />
              {photoFile && (
                <p className="card-meta" style={{ marginBottom: 12 }}>
                  Selected: {photoFile.name}
                </p>
              )}
              <button
                className="btn btn-primary btn-small"
                type="button"
                disabled={!photoFile || photoLoading}
                onClick={scanPhotoForIngredients}
              >
                {photoLoading ? "Scanning photo..." : "Extract Ingredients"}
              </button>
              {photoError && <p className="error-msg">{photoError}</p>}

              <div className="scanned-recipes-list">
                {scannedIngredients.map((ingredient, index) => (
                  <div className="card" key={`${ingredient.name}-${index}`}>
                    <div className="card-header">
                      <h3>{ingredient.name}</h3>
                    </div>
                    <div className="card-meta">
                      {(ingredient.quantity || ingredient.unit) &&
                        `${ingredient.quantity || ""} ${ingredient.unit || ""}`.trim()}
                      {ingredient.category ? ` · ${ingredient.category}` : ""}
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn btn-primary btn-small"
                        onClick={() => addScannedIngredient(index)}
                      >
                        Add
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => removeScannedIngredient(index)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {scannedIngredients.length > 0 && (
                <div className="scanned-recipes-action-bar">
                  <button
                    className="btn btn-primary"
                    onClick={addAllScannedIngredients}
                    disabled={bulkAdding}
                  >
                    {bulkAdding ? "Adding..." : "Add All Ingredients"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
