import { createContext, useContext, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [username, setUsername] = useState(localStorage.getItem("username") || "");

  async function login(usernameVal, password) {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: usernameVal, password }),
    });
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("username", data.username);
    setToken(data.access_token);
    setUsername(data.username);
  }

  async function signup(usernameVal, password, masterKey) {
    const data = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username: usernameVal, password, master_key: masterKey }),
    });
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("username", data.username);
    setToken(data.access_token);
    setUsername(data.username);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setUsername("");
  }

  return (
    <AuthContext.Provider value={{ token, username, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
