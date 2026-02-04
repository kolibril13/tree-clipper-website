// Settings page
import { supabase, ensureUsername } from '/auth.js';

export const title = 'Settings – Tree Clipper';

// Page-specific styles
const pageStyles = `
  .settings-section {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 1.5em;
    margin-bottom: 1.5em;
  }

  .settings-section h2 {
    font-size: 1.1em;
    margin: 0 0 1em 0;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .settings-section h2 .icon {
    font-size: 1.2em;
  }

  .profile-field {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
    margin-bottom: 1em;
  }

  .profile-field:last-child {
    margin-bottom: 0;
  }

  .profile-field label {
    font-size: 0.85em;
    font-weight: 500;
    color: #6b7280;
  }

  .profile-field .value {
    font-size: 1em;
    color: #232323;
    padding: 0.6em 0.8em;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  .profile-field .value.username {
    font-weight: 600;
    color: #2072cc;
  }

  .profile-field .hint {
    font-size: 0.8em;
    color: #9ca3af;
    margin-top: 0.2em;
  }

  .discord-info {
    display: flex;
    align-items: center;
    gap: 0.8em;
    padding: 0.6em 0.8em;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  .discord-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #5865F2;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 1.1em;
  }

  .discord-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .discord-details {
    display: flex;
    flex-direction: column;
    gap: 0.1em;
  }

  .discord-name {
    font-weight: 600;
    color: #232323;
  }

  .discord-id {
    font-size: 0.8em;
    color: #9ca3af;
  }

  .account-dates {
    display: flex;
    gap: 2em;
    flex-wrap: wrap;
  }

  .account-dates .date-item {
    display: flex;
    flex-direction: column;
    gap: 0.2em;
  }

  .account-dates .date-label {
    font-size: 0.8em;
    color: #9ca3af;
  }

  .account-dates .date-value {
    font-size: 0.95em;
    color: #374151;
  }

  .danger-zone {
    border-color: #fecaca;
    background: #fef2f2;
  }

  .danger-zone h2 {
    color: #991b1b;
  }

  .danger-zone p {
    color: #7f1d1d;
    font-size: 0.9em;
    margin: 0 0 1em 0;
  }

  .btn-danger-outline {
    padding: 0.6em 1.2em;
    background: transparent;
    color: #dc2626;
    border: 1px solid #dc2626;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .btn-danger-outline:hover {
    background: #dc2626;
    color: white;
  }

  .settings-delete-modal .modal-content {
    border: 2px solid #fecaca;
  }

  .settings-delete-modal h2 {
    color: #991b1b;
    margin: 0 0 1em 0;
    font-size: 1.3em;
  }

  .settings-delete-modal p {
    color: #374151;
    margin: 0 0 0.8em 0;
    font-size: 0.95em;
  }

  .settings-delete-modal ul {
    color: #7f1d1d;
    margin: 0 0 1em 0;
    padding-left: 1.5em;
    font-size: 0.9em;
  }

  .settings-delete-modal li {
    margin-bottom: 0.3em;
  }
`;

export function template() {
  return `
    <a href="/" class="back-button">←</a>

    <h1>Settings</h1>

    <div id="login-prompt" class="login-prompt">
      <p>Please log in with Discord to view your settings.</p>
    </div>

    <div id="page-content" style="display: none;">
      <nav class="nav-links">
        <a href="/my-assets">My Assets</a>
        <a href="/settings" class="active">Settings</a>
      </nav>

      <section class="settings-section">
        <h2><span class="icon">👤</span> Profile</h2>
        
        <div class="profile-field">
          <label>Username</label>
          <div class="value username" id="username-value">Loading...</div>
          <div class="hint">Your username appears in your asset URLs and cannot be changed.</div>
        </div>
      </section>

      <section class="settings-section">
        <h2><span class="icon">🔗</span> Connected Account</h2>
        
        <div class="profile-field">
          <label>Discord</label>
          <div class="discord-info">
            <div class="discord-avatar" id="discord-avatar">?</div>
            <div class="discord-details">
              <span class="discord-name" id="discord-name">Loading...</span>
              <span class="discord-id" id="discord-id"></span>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2><span class="icon">📅</span> Account</h2>
        
        <div class="account-dates">
          <div class="date-item">
            <span class="date-label">Member since</span>
            <span class="date-value" id="created-at">—</span>
          </div>
        </div>
      </section>

      <section class="settings-section danger-zone">
        <h2><span class="icon">⚠️</span> Danger Zone</h2>
        <p>Deleting your account will permanently remove all your assets and data. This cannot be undone.</p>
        <button class="btn-danger-outline" id="delete-account-btn">
          Delete Account
        </button>
      </section>

      <!-- Delete Confirmation Modal -->
      <div id="delete-modal" class="modal-overlay settings-delete-modal" style="display: none;">
        <div class="modal-content">
          <h2>⚠️ Delete Account</h2>
          <p>Are you sure you want to delete your account? This will permanently remove:</p>
          <ul>
            <li>All your uploaded assets</li>
            <li>All your asset images</li>
            <li>Your username and profile</li>
          </ul>
          <p><strong>This action cannot be undone.</strong></p>
          <div class="modal-actions">
            <button class="btn-secondary" id="cancel-delete-btn">Cancel</button>
            <button class="btn-danger" id="confirm-delete-btn">Delete My Account</button>
          </div>
        </div>
      </div>
    </div>

    <div id="output" class="status-message">
      <span class="status-icon"></span>
      <span class="status-text"></span>
    </div>
  `;
}

let currentSession = null;
let handlers = {};

export async function init() {
  // Inject page-specific styles
  const styleEl = document.createElement('style');
  styleEl.id = 'settings-styles';
  styleEl.textContent = pageStyles;
  document.head.appendChild(styleEl);
  
  // Ensure user has a username - if this returns false, user was redirected
  const hasUsername = await ensureUsername();
  if (!hasUsername) {
    // User was redirected to claim-username page, stop initialization
    // Clean up styles we just added
    const styleEl = document.getElementById('settings-styles');
    if (styleEl) styleEl.remove();
    return;
  }
  
  const loginPrompt = document.getElementById("login-prompt");
  const pageContent = document.getElementById("page-content");
  
  // Auth state handlers
  async function updateAuthUI(user) {
    if (user) {
      loginPrompt.style.display = "none";
      pageContent.style.display = "";
      await loadUserData(user);
    } else {
      loginPrompt.style.display = "";
      pageContent.style.display = "none";
    }
  }
  
  const { data: { session } } = await supabase.auth.getSession();
  currentSession = session;
  updateAuthUI(session?.user ?? null);
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    updateAuthUI(session?.user ?? null);
  });
  
  // Set up event listeners
  const deleteModal = document.getElementById("delete-modal");
  const deleteAccountBtn = document.getElementById("delete-account-btn");
  const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
  
  handlers.openDelete = () => { deleteModal.style.display = "flex"; };
  handlers.cancelDelete = () => { deleteModal.style.display = "none"; };
  handlers.modalClick = (e) => { if (e.target === deleteModal) deleteModal.style.display = "none"; };
  handlers.confirmDelete = handleConfirmDelete;
  
  deleteAccountBtn.addEventListener("click", handlers.openDelete);
  cancelDeleteBtn.addEventListener("click", handlers.cancelDelete);
  deleteModal.addEventListener("click", handlers.modalClick);
  confirmDeleteBtn.addEventListener("click", handlers.confirmDelete);
  
  // Return cleanup function
  return () => {
    subscription.unsubscribe();
    
    deleteAccountBtn.removeEventListener("click", handlers.openDelete);
    cancelDeleteBtn.removeEventListener("click", handlers.cancelDelete);
    deleteModal.removeEventListener("click", handlers.modalClick);
    confirmDeleteBtn.removeEventListener("click", handlers.confirmDelete);
    
    const styleEl = document.getElementById('settings-styles');
    if (styleEl) styleEl.remove();
  };
}

async function loadUserData(user) {
  const usernameValue = document.getElementById("username-value");
  const discordAvatar = document.getElementById("discord-avatar");
  const discordName = document.getElementById("discord-name");
  const discordId = document.getElementById("discord-id");
  const createdAt = document.getElementById("created-at");
  
  // Load Discord info from user metadata
  const metadata = user.user_metadata || {};
  const avatarUrl = metadata.avatar_url;
  const globalName = metadata.custom_claims?.global_name || metadata.full_name || metadata.name || "Discord User";
  
  // Set Discord info
  discordName.textContent = globalName;
  discordId.textContent = user.email ? `${user.email}` : "";
  
  if (avatarUrl) {
    discordAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" />`;
  } else {
    discordAvatar.textContent = globalName.charAt(0).toUpperCase();
  }

  // Load username from our API
  try {
    const res = await fetch("/api/users/me", {
      headers: { "Authorization": `Bearer ${currentSession.access_token}` }
    });
    
    if (res.ok) {
      const profile = await res.json();
      usernameValue.textContent = profile.username ? `@${profile.username}` : "Not set";
      
      if (profile.created_at) {
        createdAt.textContent = formatDate(profile.created_at);
      }
    }
  } catch (err) {
    console.error("Failed to load profile:", err);
    usernameValue.textContent = "Error loading";
  }
}

async function handleConfirmDelete() {
  if (!currentSession) {
    showStatus("Not logged in", true);
    return;
  }

  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting...";

  try {
    const res = await fetch("/api/users/me", {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${currentSession.access_token}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Failed to delete account");
    }

    // Sign out and redirect
    await supabase.auth.signOut();
    window.spaNavigate('/');
  } catch (err) {
    console.error("Delete account error:", err);
    showStatus(err.message || "Failed to delete account", true);
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Delete My Account";
    document.getElementById("delete-modal").style.display = "none";
  }
}

function formatDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function showStatus(message, isError = false) {
  const output = document.getElementById("output");
  output.style.display = "flex";
  output.className = `status-message visible ${isError ? "error" : "success"}`;
  output.querySelector(".status-icon").textContent = isError ? "✕" : "✓";
  output.querySelector(".status-text").textContent = message;
  
  if (!isError) {
    setTimeout(() => {
      output.style.display = "none";
    }, 3000);
  }
}
