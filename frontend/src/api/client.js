const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: getHeaders(),
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.hash = "#/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function apiStream(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.body;
}

export { API_URL };
