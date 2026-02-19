import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [sortBy, setSortBy] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    loadRecipes();
  }, [sortBy, order, ingredientSearch]);

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

      {recipes.map((recipe) => (
        <div className="card" key={recipe.id} onClick={() => toggleExpand(recipe.id)}>
          <div className="card-header">
            <h3>{recipe.name}</h3>
          </div>
          <div className="card-meta">
            {recipe.prep_time_minutes && `${recipe.prep_time_minutes} min`}
            {recipe.source && ` · ${recipe.source}`}
          </div>

          {expanded === recipe.id && (
            <div className="card-body">
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
                  <p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{recipe.instructions}</p>
                </div>
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
    </div>
  );
}
