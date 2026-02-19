import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { logout, username } = useAuth();

  return (
    <nav className="nav-bar">
      <NavLink to="/chat" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
        <span className="nav-icon">💬</span>
        <span className="nav-label">Chat</span>
      </NavLink>
      <NavLink to="/recipes" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
        <span className="nav-icon">📖</span>
        <span className="nav-label">Recipes</span>
      </NavLink>
      <NavLink to="/pantry" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
        <span className="nav-icon">🥫</span>
        <span className="nav-label">Pantry</span>
      </NavLink>
      <button className="nav-link nav-logout" onClick={logout} title={`Signed in as ${username}`}>
        <span className="nav-icon">↩</span>
        <span className="nav-label">Out</span>
      </button>
    </nav>
  );
}
