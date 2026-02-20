import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Low-Carb",
  "Keto",
  "Paleo",
  "Halal",
  "Kosher",
];

export default function Profile() {
  const { logout, username } = useAuth();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [selectedDietary, setSelectedDietary] = useState([]);
  const [customPrefs, setCustomPrefs] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [memberSince, setMemberSince] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await api("/profile");
      setDisplayName(data.display_name || "");
      const prefs = data.dietary_preferences || {};
      setSelectedDietary(prefs.dietary || []);
      setCustomPrefs(prefs.notes || "");
      if (data.created_at) {
        setMemberSince(new Date(data.created_at).toLocaleDateString());
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }

  function toggleDietary(option) {
    setSelectedDietary((prev) =>
      prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]
    );
  }

  async function saveProfile(e) {
    e.preventDefault();
    setProfileMsg("");
    setProfileError("");
    setProfileSaving(true);
    try {
      await api("/profile", {
        method: "PUT",
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          dietary_preferences: {
            dietary: selectedDietary,
            notes: customPrefs.trim(),
          },
        }),
      });
      setProfileMsg("Profile updated.");
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg("");
    setPwError("");
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      setPwError("New password must be at least 4 characters.");
      return;
    }
    setPwSaving(true);
    try {
      await api("/profile/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setPwMsg("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <p className="card-meta">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="page-container profile-page">
      <h1>Profile</h1>

      <section className="profile-section">
        <div className="profile-username-row">
          <span className="profile-avatar">{(displayName || username || "?")[0].toUpperCase()}</span>
          <div>
            <div className="profile-display-name">{displayName || username}</div>
            <div className="card-meta">@{username}{memberSince ? ` · Member since ${memberSince}` : ""}</div>
          </div>
        </div>
      </section>

      <section className="profile-section">
        <h2>Personal info</h2>
        <form className="profile-form" onSubmit={saveProfile}>
          <label className="profile-label">
            Display name
            <input
              type="text"
              placeholder="What should our AI call you?"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>

          <div className="profile-label">Dietary preferences</div>
          <div className="profile-chips">
            {DIETARY_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                className={`profile-chip ${selectedDietary.includes(option) ? "active" : ""}`}
                onClick={() => toggleDietary(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <label className="profile-label">
            Additional notes
            <textarea
              placeholder="Allergies, dislikes, household size..."
              value={customPrefs}
              onChange={(e) => setCustomPrefs(e.target.value)}
            />
          </label>

          {profileMsg && <p className="success-msg">{profileMsg}</p>}
          {profileError && <p className="error-msg">{profileError}</p>}

          <button className="btn btn-primary" type="submit" disabled={profileSaving}>
            {profileSaving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      <section className="profile-section">
        <h2>Change password</h2>
        <form className="profile-form" onSubmit={changePassword}>
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {pwMsg && <p className="success-msg">{pwMsg}</p>}
          {pwError && <p className="error-msg">{pwError}</p>}

          <button className="btn btn-primary" type="submit" disabled={pwSaving}>
            {pwSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </section>

      <section className="profile-section">
        <button className="btn btn-danger profile-logout-btn" onClick={logout}>
          Log out
        </button>
      </section>
    </div>
  );
}
