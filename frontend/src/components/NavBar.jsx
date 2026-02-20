import { NavLink } from "react-router-dom";

export default function NavBar() {
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
      <NavLink to="/shopping-list" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
        <span className="nav-icon">🛒</span>
        <span className="nav-label">Shop</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
        <span className="nav-icon">👤</span>
        <span className="nav-label">Profile</span>
      </NavLink>
    </nav>
  );
}
