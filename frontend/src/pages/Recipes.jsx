import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

const DEFAULT_CATEGORY_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];
const CUSTOM_CATEGORY_VALUE = "__custom__";
const UNCATEGORIZED_LABEL = "Uncategorized";

function blankIngredient() {
  return { name: "", quantity: "", unit: "" };
}

function blankRecipeForm() {
  return {
    name: "",
    description: "",
    ingredients: [blankIngredient()],
    prep_time_minutes: "",
    instructions: "",
    source: "",
    favourite: false,
    category: "",
  };
}

function recipeToForm(recipe) {
  return {
    name: recipe?.name || "",
    description: recipe?.description || "",
    ingredients:
      recipe?.ingredients && recipe.ingredients.length > 0
        ? recipe.ingredients.map((item) => ({
            name: item?.name || "",
            quantity: item?.quantity || "",
            unit: item?.unit || "",
          }))
        : [blankIngredient()],
    prep_time_minutes:
      recipe?.prep_time_minutes === null || recipe?.prep_time_minutes === undefined
        ? ""
        : String(recipe.prep_time_minutes),
    instructions: recipe?.instructions || "",
    source: recipe?.source || "",
    favourite: Boolean(recipe?.favourite),
    category: recipe?.category || "",
  };
}

function buildRecipePayload(form) {
  const cleanedIngredients = (form.ingredients || [])
    .map((item) => ({
      name: (item?.name || "").trim(),
      quantity: (item?.quantity || "").trim(),
      unit: (item?.unit || "").trim(),
    }))
    .filter((item) => item.name);

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    ingredients: cleanedIngredients,
    prep_time_minutes: form.prep_time_minutes ? Number(form.prep_time_minutes) : null,
    instructions: form.instructions.trim() || null,
    source: form.source.trim() || null,
    favourite: form.favourite,
    category: form.category.trim() || null,
  };
}

function normalizeCategory(category) {
  const trimmed = (category || "").trim();
  return trimmed || UNCATEGORIZED_LABEL;
}

function CategoryCollapse({ categoryName, recipeCount, isOpen, onToggle, children }) {
  return (
    <section className="category-collapse">
      <button className="category-collapse-trigger" type="button" onClick={onToggle}>
        <span>{isOpen ? "▾" : "▸"} {categoryName}</span>
        <span>{recipeCount}</span>
      </button>
      {isOpen && <div className="category-collapse-content">{children}</div>}
    </section>
  );
}

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [sortBy, setSortBy] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState("menu");
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scannedRecipes, setScannedRecipes] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [manualForm, setManualForm] = useState(blankRecipeForm());
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [editForm, setEditForm] = useState(blankRecipeForm());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editingScannedIndex, setEditingScannedIndex] = useState(null);
  const [scannedEditForm, setScannedEditForm] = useState(blankRecipeForm());
  const [scannedEditError, setScannedEditError] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [selectedCategoryOption, setSelectedCategoryOption] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const uploadPhotoInputRef = useRef(null);
  const cameraPhotoInputRef = useRef(null);

  useEffect(() => {
    loadRecipes();
  }, [sortBy, order, ingredientSearch]);

  useEffect(() => {
    if (!editingRecipeId) return;

    function handleClickAway(event) {
      const card = event.target.closest?.(".recipe-card");
      if (!card || card.dataset.recipeId !== String(editingRecipeId)) {
        setEditingRecipeId(null);
        setEditForm(blankRecipeForm());
        setEditError("");
      }
    }

    document.addEventListener("mousedown", handleClickAway);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
    };
  }, [editingRecipeId]);

  const categoryOptions = useMemo(() => {
    const unique = new Map();
    for (const category of DEFAULT_CATEGORY_OPTIONS) {
      unique.set(category.toLowerCase(), category);
    }
    for (const recipe of recipes) {
      const normalized = (recipe.category || "").trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, normalized);
      }
    }
    return Array.from(unique.values());
  }, [recipes]);

  const recipesByCategory = useMemo(() => {
    const groups = new Map();
    for (const recipe of recipes) {
      const categoryName = normalizeCategory(recipe.category);
      if (!groups.has(categoryName)) {
        groups.set(categoryName, []);
      }
      groups.get(categoryName).push(recipe);
    }
    return Array.from(groups.entries()).map(([categoryName, items]) => ({
      categoryName,
      items,
    }));
  }, [recipes]);

  async function loadRecipes() {
    try {
      let url = `/recipes?sort_by=${sortBy}&order=${order}`;
      if (ingredientSearch.trim()) {
        url += `&ingredient=${encodeURIComponent(ingredientSearch.trim())}`;
      }
      const data = await api(url);
      setRecipes(data);
    } catch {
      /* empty */
    }
  }

  async function deleteRecipe(id) {
    try {
      await api(`/recipes/${id}`, { method: "DELETE" });
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* empty */
    }
  }

  function toggleExpand(id) {
    setExpanded(expanded === id ? null : id);
  }

  function toggleCategoryCollapse(categoryName) {
    setCollapsedCategories((prev) => {
      const isOpen = prev[categoryName] !== false;
      return { ...prev, [categoryName]: !isOpen };
    });
  }

  function openCreateMenu() {
    setCreateMode("menu");
    setCreateOpen(true);
  }

  function closeCreateFlow() {
    setCreateOpen(false);
    setCreateMode("menu");
    setScanError("");
    setManualError("");
    setPhotoFile(null);
    setPhotoLoading(false);
  }

  async function openConversationImport() {
    setCreateMode("conversation");
    setScanError("");
    setScannedRecipes([]);
    if (chatSessions.length > 0) return;
    try {
      const sessions = await api("/chat/sessions");
      setChatSessions(sessions);
    } catch (err) {
      setScanError(err.message);
    }
  }

  function openPhotoImport() {
    setCreateMode("photo");
    setScanError("");
    setScannedRecipes([]);
    setPhotoFile(null);
  }

  async function scanConversation() {
    if (!selectedSessionId) return;
    setScanLoading(true);
    setScanError("");
    try {
      const data = await api("/recipes/scan-conversation", {
        method: "POST",
        body: JSON.stringify({ session_id: selectedSessionId }),
      });
      setScannedRecipes(data.recipes || []);
      if (!data.recipes || data.recipes.length === 0) {
        setScanError("No recipes were found in that conversation.");
      }
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanLoading(false);
    }
  }

  function onPhotoSelected(e) {
    const selected = e.target.files?.[0] || null;
    setPhotoFile(selected);
    setScanError("");
    setScannedRecipes([]);
  }

  async function scanPhotoForRecipes() {
    if (!photoFile) return;
    setPhotoLoading(true);
    setScanError("");
    setScannedRecipes([]);
    try {
      const form = new FormData();
      form.append("photo", photoFile);
      const data = await api("/recipes/scan-photo", {
        method: "POST",
        body: form,
      });
      setScannedRecipes(data.recipes || []);
      if (!data.recipes || data.recipes.length === 0) {
        setScanError("No recipes were detected in that photo.");
      }
    } catch (err) {
      setScanError(err.message);
    } finally {
      setPhotoLoading(false);
    }
  }

  async function addRecipeFromPreview(index) {
    const target = scannedRecipes[index];
    if (!target) return;
    try {
      const created = await api("/recipes", {
        method: "POST",
        body: JSON.stringify(target),
      });
      setRecipes((prev) => [created, ...prev]);
      setScannedRecipes((prev) => prev.filter((_, i) => i !== index));
    } catch (err) {
      setScanError(err.message);
    }
  }

  function removeScannedRecipe(index) {
    setScannedRecipes((prev) => prev.filter((_, i) => i !== index));
  }

  async function addAllScannedRecipes() {
    if (scannedRecipes.length === 0 || bulkAdding) return;
    setBulkAdding(true);
    setScanError("");
    try {
      const createdRecipes = [];
      for (const candidate of scannedRecipes) {
        // Create in sequence so API errors map cleanly to the first failing item.
        const created = await api("/recipes", {
          method: "POST",
          body: JSON.stringify(candidate),
        });
        createdRecipes.push(created);
      }
      setRecipes((prev) => [...createdRecipes, ...prev]);
      setScannedRecipes([]);
      closeCreateFlow();
    } catch (err) {
      setScanError(err.message);
    } finally {
      setBulkAdding(false);
    }
  }

  async function toggleFavourite(recipeId, currentValue) {
    const nextValue = !currentValue;
    setRecipes((prev) =>
      prev.map((recipe) =>
        recipe.id === recipeId ? { ...recipe, favourite: nextValue } : recipe
      )
    );
    try {
      const updated = await api(`/recipes/${recipeId}`, {
        method: "PUT",
        body: JSON.stringify({ favourite: nextValue }),
      });
      setRecipes((prev) =>
        prev.map((recipe) => (recipe.id === recipeId ? updated : recipe))
      );
    } catch {
      setRecipes((prev) =>
        prev.map((recipe) =>
          recipe.id === recipeId ? { ...recipe, favourite: currentValue } : recipe
        )
      );
    }
  }

  function startEditRecipe(recipe, e) {
    e.stopPropagation();
    setExpanded(recipe.id);
    setEditingRecipeId(recipe.id);
    setEditForm(recipeToForm(recipe));
    setEditError("");
  }

  function cancelEditRecipe(e) {
    e.stopPropagation();
    setEditingRecipeId(null);
    setEditForm(blankRecipeForm());
    setEditError("");
  }

  function updateEditField(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateEditIngredient(index, field, value) {
    setEditForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addEditIngredientRow() {
    setEditForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, blankIngredient()],
    }));
  }

  function removeEditIngredientRow(index) {
    setEditForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  async function saveEditedRecipe(recipeId, e) {
    e.stopPropagation();
    setEditError("");
    const payload = buildRecipePayload(editForm);

    if (!payload.name) {
      setEditError("Recipe name is required.");
      return;
    }
    if (payload.ingredients.length === 0) {
      setEditError("At least one ingredient is required.");
      return;
    }

    setEditSaving(true);
    try {
      const updated = await api(`/recipes/${recipeId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setRecipes((prev) => prev.map((recipe) => (recipe.id === recipeId ? updated : recipe)));
      setEditingRecipeId(null);
      setEditForm(blankRecipeForm());
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  function startEditScannedRecipe(index) {
    const target = scannedRecipes[index];
    if (!target) return;
    setEditingScannedIndex(index);
    setScannedEditForm(recipeToForm(target));
    setScannedEditError("");
  }

  function cancelEditScannedRecipe() {
    setEditingScannedIndex(null);
    setScannedEditForm(blankRecipeForm());
    setScannedEditError("");
  }

  function updateScannedEditField(field, value) {
    setScannedEditForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateScannedEditIngredient(index, field, value) {
    setScannedEditForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addScannedEditIngredientRow() {
    setScannedEditForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, blankIngredient()],
    }));
  }

  function removeScannedEditIngredientRow(index) {
    setScannedEditForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  function saveScannedEdit(index) {
    const payload = buildRecipePayload(scannedEditForm);
    if (!payload.name) {
      setScannedEditError("Recipe name is required.");
      return;
    }
    if (payload.ingredients.length === 0) {
      setScannedEditError("At least one ingredient is required.");
      return;
    }
    setScannedRecipes((prev) => prev.map((recipe, i) => (i === index ? payload : recipe)));
    cancelEditScannedRecipe();
  }

  function updateManualField(field, value) {
    setManualForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateManualIngredient(index, field, value) {
    setManualForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addManualIngredientRow() {
    setManualForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, blankIngredient()],
    }));
  }

  function removeManualIngredientRow(index) {
    setManualForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  async function submitManualRecipe(e) {
    e.preventDefault();
    setManualError("");
    const payload = buildRecipePayload({
      ...manualForm,
      category:
        selectedCategoryOption === CUSTOM_CATEGORY_VALUE
          ? customCategory.trim()
          : selectedCategoryOption || "",
    });

    if (!payload.name) {
      setManualError("Recipe name is required.");
      return;
    }
    if (payload.ingredients.length === 0) {
      setManualError("At least one ingredient is required.");
      return;
    }

    setManualSaving(true);
    try {
      const created = await api("/recipes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setRecipes((prev) => [created, ...prev]);
      setManualForm(blankRecipeForm());
      setSelectedCategoryOption("");
      setCustomCategory("");
      closeCreateFlow();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <div className="page-container">
      <h1>Recipes</h1>

      <div className="search-sort-bar">
        <input
          type="text"
          placeholder="Search by ingredient..."
          value={ingredientSearch}
          onChange={(e) => setIngredientSearch(e.target.value)}
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="created_at">Date</option>
          <option value="name">Name</option>
          <option value="prep_time_minutes">Prep Time</option>
          <option value="source">Source</option>
          <option value="category">Category</option>
          <option value="favourite">Favourite</option>
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>

      {recipes.length === 0 && (
        <div className="empty-state">
          No recipes yet. Ask the AI to help you create some!
        </div>
      )}

      {recipesByCategory.map(({ categoryName, items }) => (
        <CategoryCollapse
          key={categoryName}
          categoryName={categoryName}
          recipeCount={items.length}
          isOpen={collapsedCategories[categoryName] !== false}
          onToggle={() => toggleCategoryCollapse(categoryName)}
        >
          {items.map((recipe) => (
            <div
              className="card recipe-card"
              data-recipe-id={recipe.id}
              key={recipe.id}
              onClick={() => toggleExpand(recipe.id)}
            >
              <div className="card-header">
                <h3>{recipe.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={(e) => startEditRecipe(recipe, e)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`recipe-star-btn ${recipe.favourite ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavourite(recipe.id, recipe.favourite);
                    }}
                    aria-label={
                      recipe.favourite ? "Remove from favourites" : "Add to favourites"
                    }
                    title={recipe.favourite ? "Favourite" : "Mark as favourite"}
                  >
                    {recipe.favourite ? "★" : "☆"}
                  </button>
                </div>
              </div>
              <div className="card-meta">
                {recipe.prep_time_minutes && `${recipe.prep_time_minutes} min`}
                {recipe.source && ` · ${recipe.source}`}
                {recipe.category && ` · ${recipe.category}`}
              </div>

              {expanded === recipe.id && (
                <div className="card-body">
                  {editingRecipeId === recipe.id ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <form className="manual-recipe-form">
                        <input
                          type="text"
                          placeholder="Recipe name"
                          value={editForm.name}
                          onChange={(e) => updateEditField("name", e.target.value)}
                          required
                        />
                        <textarea
                          placeholder="Description"
                          value={editForm.description}
                          onChange={(e) => updateEditField("description", e.target.value)}
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="Prep time (minutes)"
                          value={editForm.prep_time_minutes}
                          onChange={(e) => updateEditField("prep_time_minutes", e.target.value)}
                        />
                        <textarea
                          placeholder="Instructions"
                          value={editForm.instructions}
                          onChange={(e) => updateEditField("instructions", e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Source"
                          value={editForm.source}
                          onChange={(e) => updateEditField("source", e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Category"
                          value={editForm.category}
                          onChange={(e) => updateEditField("category", e.target.value)}
                        />
                        <h3>Ingredients</h3>
                        {editForm.ingredients.map((ingredient, index) => (
                          <div className="manual-ingredient-row" key={index}>
                            <input
                              type="text"
                              placeholder="Name"
                              value={ingredient.name}
                              onChange={(e) =>
                                updateEditIngredient(index, "name", e.target.value)
                              }
                            />
                            <input
                              type="text"
                              placeholder="Qty"
                              value={ingredient.quantity}
                              onChange={(e) =>
                                updateEditIngredient(index, "quantity", e.target.value)
                              }
                            />
                            <input
                              type="text"
                              placeholder="Unit"
                              value={ingredient.unit}
                              onChange={(e) => updateEditIngredient(index, "unit", e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-danger btn-small"
                              onClick={() => removeEditIngredientRow(index)}
                              disabled={editForm.ingredients.length === 1}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          onClick={addEditIngredientRow}
                        >
                          + Ingredient
                        </button>
                        {editError && <p className="error-msg">{editError}</p>}
                      </form>
                      <div className="card-actions">
                        <button
                          className="btn btn-primary btn-small"
                          onClick={(e) => saveEditedRecipe(recipe.id, e)}
                          disabled={editSaving}
                        >
                          {editSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={(e) => cancelEditRecipe(e)}
                          disabled={editSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {recipe.description && <p>{recipe.description}</p>}

                      {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <strong>Ingredients:</strong>
                          <div style={{ marginTop: 4 }}>
                            {recipe.ingredients.map((ing, i) => (
                              <span className="tag" key={i}>
                                {ing.quantity} {ing.unit} {ing.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {recipe.instructions && (
                        <div>
                          <strong>Instructions:</strong>
                          <p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                            {recipe.instructions}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="card-actions">
                    <button
                      className="btn btn-danger btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRecipe(recipe.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CategoryCollapse>
      ))}

      <div className="recipe-fab-wrap">
        <button className="recipe-fab" onClick={openCreateMenu}>
          + Create Recipe
        </button>
      </div>

      {createOpen && (
        <div className="recipe-overlay" onClick={closeCreateFlow}>
          <div className="recipe-sheet" onClick={(e) => e.stopPropagation()}>
            <button
              className="recipe-close-btn"
              onClick={closeCreateFlow}
              aria-label="Close create recipe modal"
            >
              ×
            </button>

            {createMode !== "menu" && (
              <button className="recipe-back-btn" onClick={() => setCreateMode("menu")}>
                ← Back
              </button>
            )}

            {createMode === "menu" && (
              <div className="recipe-create-menu">
                <h2>Create Recipe</h2>
                <button className="btn btn-primary" onClick={openConversationImport}>
                  Import from conversation
                </button>
                <button className="btn btn-primary" onClick={openPhotoImport}>
                  Import from photo
                </button>
                <button className="btn btn-primary" onClick={() => setCreateMode("manual")}>
                  Create manually
                </button>
              </div>
            )}

            {createMode === "photo" && (
              <div className="recipe-mode-panel">
                <h2>Import from photo</h2>
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
                  onClick={scanPhotoForRecipes}
                >
                  {photoLoading ? "Scanning photo..." : "Extract Recipes"}
                </button>
                {scanError && <p className="error-msg">{scanError}</p>}
                <div className="scanned-recipes-list">
                  {scannedRecipes.map((recipe, index) => (
                    <div className="card" key={`${recipe.name}-${index}`}>
                      <div className="card-header">
                        <h3>
                          {recipe.favourite ? "⭐ " : ""}
                          {recipe.name}
                        </h3>
                      </div>
                      <div className="card-meta">
                        {recipe.prep_time_minutes
                          ? `${recipe.prep_time_minutes} min`
                          : "Prep time unknown"}
                        {recipe.source ? ` · ${recipe.source}` : ""}
                        {recipe.category ? ` · ${recipe.category}` : ""}
                      </div>
                      {editingScannedIndex === index ? (
                        <div className="manual-recipe-form">
                          <input
                            type="text"
                            placeholder="Recipe name"
                            value={scannedEditForm.name}
                            onChange={(e) => updateScannedEditField("name", e.target.value)}
                          />
                          <textarea
                            placeholder="Description"
                            value={scannedEditForm.description}
                            onChange={(e) =>
                              updateScannedEditField("description", e.target.value)
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Prep time (minutes)"
                            value={scannedEditForm.prep_time_minutes}
                            onChange={(e) =>
                              updateScannedEditField("prep_time_minutes", e.target.value)
                            }
                          />
                          <textarea
                            placeholder="Instructions"
                            value={scannedEditForm.instructions}
                            onChange={(e) =>
                              updateScannedEditField("instructions", e.target.value)
                            }
                          />
                          <input
                            type="text"
                            placeholder="Source"
                            value={scannedEditForm.source}
                            onChange={(e) => updateScannedEditField("source", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Category"
                            value={scannedEditForm.category}
                            onChange={(e) => updateScannedEditField("category", e.target.value)}
                          />
                          <h3>Ingredients</h3>
                          {scannedEditForm.ingredients.map((ingredient, ingredientIndex) => (
                            <div className="manual-ingredient-row" key={ingredientIndex}>
                              <input
                                type="text"
                                placeholder="Name"
                                value={ingredient.name}
                                onChange={(e) =>
                                  updateScannedEditIngredient(
                                    ingredientIndex,
                                    "name",
                                    e.target.value
                                  )
                                }
                              />
                              <input
                                type="text"
                                placeholder="Qty"
                                value={ingredient.quantity}
                                onChange={(e) =>
                                  updateScannedEditIngredient(
                                    ingredientIndex,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                              />
                              <input
                                type="text"
                                placeholder="Unit"
                                value={ingredient.unit}
                                onChange={(e) =>
                                  updateScannedEditIngredient(
                                    ingredientIndex,
                                    "unit",
                                    e.target.value
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="btn btn-danger btn-small"
                                onClick={() => removeScannedEditIngredientRow(ingredientIndex)}
                                disabled={scannedEditForm.ingredients.length === 1}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={addScannedEditIngredientRow}
                          >
                            + Ingredient
                          </button>
                          {scannedEditError && <p className="error-msg">{scannedEditError}</p>}
                        </div>
                      ) : (
                        <>
                          {recipe.description && <p>{recipe.description}</p>}
                          <div style={{ marginBottom: 8 }}>
                            <strong>Ingredients:</strong>
                            <div style={{ marginTop: 4 }}>
                              {(recipe.ingredients || []).map((ing, i) => (
                                <span className="tag" key={i}>
                                  {ing.quantity} {ing.unit} {ing.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          {recipe.instructions && (
                            <div>
                              <strong>Instructions:</strong>
                              <p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                                {recipe.instructions}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                      <div className="card-actions">
                        {editingScannedIndex === index ? (
                          <>
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => saveScannedEdit(index)}
                            >
                              Save edit
                            </button>
                            <button
                              className="btn btn-danger btn-small"
                              onClick={cancelEditScannedRecipe}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => startEditScannedRecipe(index)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => addRecipeFromPreview(index)}
                            >
                              Add
                            </button>
                          </>
                        )}
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => removeScannedRecipe(index)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {scannedRecipes.length > 0 && (
                  <div className="scanned-recipes-action-bar">
                    <button
                      className="btn btn-primary"
                      onClick={addAllScannedRecipes}
                      disabled={bulkAdding}
                    >
                      {bulkAdding ? "Adding..." : "Add All Recipes"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {createMode === "conversation" && (
              <div className="recipe-mode-panel">
                <h2>Import from conversation</h2>
                <div className="search-sort-bar" style={{ marginBottom: 12 }}>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                  >
                    <option value="">Select a conversation...</option>
                    {chatSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.title}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary btn-small"
                    disabled={!selectedSessionId || scanLoading}
                    onClick={scanConversation}
                  >
                    {scanLoading ? "Scanning..." : "Scan Conversation"}
                  </button>
                </div>

                {scanError && <p className="error-msg">{scanError}</p>}

                <div className="scanned-recipes-list">
                  {scannedRecipes.map((recipe, index) => (
                    <div className="card" key={`${recipe.name}-${index}`}>
                      <div className="card-header">
                        <h3>
                          {recipe.favourite ? "⭐ " : ""}
                          {recipe.name}
                        </h3>
                      </div>
                      <div className="card-meta">
                        {recipe.prep_time_minutes
                          ? `${recipe.prep_time_minutes} min`
                          : "Prep time unknown"}
                        {recipe.source ? ` · ${recipe.source}` : ""}
                        {recipe.category ? ` · ${recipe.category}` : ""}
                      </div>
                      {editingScannedIndex === index ? (
                        <div className="manual-recipe-form">
                          <input
                            type="text"
                            placeholder="Recipe name"
                            value={scannedEditForm.name}
                            onChange={(e) => updateScannedEditField("name", e.target.value)}
                          />
                          <textarea
                            placeholder="Description"
                            value={scannedEditForm.description}
                            onChange={(e) =>
                              updateScannedEditField("description", e.target.value)
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Prep time (minutes)"
                            value={scannedEditForm.prep_time_minutes}
                            onChange={(e) =>
                              updateScannedEditField("prep_time_minutes", e.target.value)
                            }
                          />
                          <textarea
                            placeholder="Instructions"
                            value={scannedEditForm.instructions}
                            onChange={(e) =>
                              updateScannedEditField("instructions", e.target.value)
                            }
                          />
                          <input
                            type="text"
                            placeholder="Source"
                            value={scannedEditForm.source}
                            onChange={(e) => updateScannedEditField("source", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Category"
                            value={scannedEditForm.category}
                            onChange={(e) => updateScannedEditField("category", e.target.value)}
                          />
                          <h3>Ingredients</h3>
                          {scannedEditForm.ingredients.map((ingredient, ingredientIndex) => (
                            <div className="manual-ingredient-row" key={ingredientIndex}>
                              <input
                                type="text"
                                placeholder="Name"
                                value={ingredient.name}
                                onChange={(e) =>
                                  updateScannedEditIngredient(
                                    ingredientIndex,
                                    "name",
                                    e.target.value
                                  )
                                }
                              />
                              <input
                                type="text"
                                placeholder="Qty"
                                value={ingredient.quantity}
                                onChange={(e) =>
                                  updateScannedEditIngredient(
                                    ingredientIndex,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                              />
                              <input
                                type="text"
                                placeholder="Unit"
                                value={ingredient.unit}
                                onChange={(e) =>
                                  updateScannedEditIngredient(
                                    ingredientIndex,
                                    "unit",
                                    e.target.value
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="btn btn-danger btn-small"
                                onClick={() => removeScannedEditIngredientRow(ingredientIndex)}
                                disabled={scannedEditForm.ingredients.length === 1}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={addScannedEditIngredientRow}
                          >
                            + Ingredient
                          </button>
                          {scannedEditError && <p className="error-msg">{scannedEditError}</p>}
                        </div>
                      ) : (
                        <>
                          {recipe.description && <p>{recipe.description}</p>}
                          <div style={{ marginBottom: 8 }}>
                            <strong>Ingredients:</strong>
                            <div style={{ marginTop: 4 }}>
                              {(recipe.ingredients || []).map((ing, i) => (
                                <span className="tag" key={i}>
                                  {ing.quantity} {ing.unit} {ing.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          {recipe.instructions && (
                            <div>
                              <strong>Instructions:</strong>
                              <p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                                {recipe.instructions}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                      <div className="card-actions">
                        {editingScannedIndex === index ? (
                          <>
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => saveScannedEdit(index)}
                            >
                              Save edit
                            </button>
                            <button
                              className="btn btn-danger btn-small"
                              onClick={cancelEditScannedRecipe}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => startEditScannedRecipe(index)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => addRecipeFromPreview(index)}
                            >
                              Add
                            </button>
                          </>
                        )}
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => removeScannedRecipe(index)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {scannedRecipes.length > 0 && (
                  <div className="scanned-recipes-action-bar">
                    <button
                      className="btn btn-primary"
                      onClick={addAllScannedRecipes}
                      disabled={bulkAdding}
                    >
                      {bulkAdding ? "Adding..." : "Add All Recipes"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {createMode === "manual" && (
              <div className="recipe-mode-panel">
                <h2>Create manually</h2>
                <form className="manual-recipe-form" onSubmit={submitManualRecipe}>
                  <input
                    type="text"
                    placeholder="Recipe name"
                    value={manualForm.name}
                    onChange={(e) => updateManualField("name", e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Description"
                    value={manualForm.description}
                    onChange={(e) => updateManualField("description", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Prep time (minutes)"
                    value={manualForm.prep_time_minutes}
                    onChange={(e) => updateManualField("prep_time_minutes", e.target.value)}
                  />
                  <textarea
                    placeholder="Instructions"
                    value={manualForm.instructions}
                    onChange={(e) => updateManualField("instructions", e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Source"
                    value={manualForm.source}
                    onChange={(e) => updateManualField("source", e.target.value)}
                  />
                  <select
                    value={selectedCategoryOption}
                    onChange={(e) => setSelectedCategoryOption(e.target.value)}
                  >
                    <option value="">Category (optional)</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY_VALUE}>+ Create custom category</option>
                  </select>
                  {selectedCategoryOption === CUSTOM_CATEGORY_VALUE && (
                    <input
                      type="text"
                      placeholder="Custom category"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                    />
                  )}
                  <h3>Ingredients</h3>
                  {manualForm.ingredients.map((ingredient, index) => (
                    <div className="manual-ingredient-row" key={index}>
                      <input
                        type="text"
                        placeholder="Name"
                        value={ingredient.name}
                        onChange={(e) => updateManualIngredient(index, "name", e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Qty"
                        value={ingredient.quantity}
                        onChange={(e) => updateManualIngredient(index, "quantity", e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={ingredient.unit}
                        onChange={(e) => updateManualIngredient(index, "unit", e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => removeManualIngredientRow(index)}
                        disabled={manualForm.ingredients.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={addManualIngredientRow}
                  >
                    + Ingredient
                  </button>

                  {manualError && <p className="error-msg">{manualError}</p>}

                  <button type="submit" className="btn btn-primary" disabled={manualSaving}>
                    {manualSaving ? "Creating..." : "Create Recipe"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
