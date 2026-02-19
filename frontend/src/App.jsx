import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import Recipes from "./pages/Recipes";
import Pantry from "./pages/Pantry";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const { token } = useAuth();

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        <Routes>
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
          <Route path="/pantry" element={<ProtectedRoute><Pantry /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </div>
      <NavBar />
    </div>
  );
}
