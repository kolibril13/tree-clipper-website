// Claim username page
import { supabase, clearCachedProfile } from '../auth.js';
import { users } from '../api.js';

export const title = 'Choose Your Username – Tree Clipper';

export function template() {
  return `
    <h1>Choose Your Username</h1>
    
    <div class="username-form-container">
      <p class="username-intro">
        Welcome to <strong>Tree Clipper</strong>! 🌳<br>
        Pick a unique username that will appear in your asset URLs.
      </p>
      
      <form id="username-form" class="asset-form">
        <div class="form-group">
          <label for="username">Username</label>
          <div class="username-input-wrapper">
            <span class="username-prefix">@</span>
            <input 
              type="text" 
              id="username" 
              class="username-input"
              placeholder="spaghetti_wizard09"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              maxlength="20"
              required
            >
          </div>
          <div class="username-hint">
            3-20 characters. Lowercase letters, numbers, hyphens, and underscores.
          </div>
          <div id="username-status" class="username-status"></div>
        </div>
        
        <div class="warning-box">
          <strong>⚠️ Cannot be changed later</strong>
          Your username will appear in all your asset links (e.g. tree-clipper.com/<strong>@yourname</strong>/asset-name). 
          Choose wisely!
        </div>
        
        <button type="submit" id="claim-btn" class="btn-primary" disabled>
          Claim Username
        </button>
      </form>
    </div>

    <div id="output" class="status-message">
      <span class="status-icon"></span>
      <span class="status-text"></span>
    </div>
  `;
}

// Page-scoped styles (injected into template)
const pageStyles = `
  .username-form-container {
    max-width: 400px;
    margin: 0 auto;
  }
  
  .username-intro {
    text-align: center;
    margin-bottom: 2em;
    color: #a3a9b4;
    line-height: 1.6;
  }
  
  .username-intro strong {
    color: #cbd0d8;
  }
  
  .username-input-wrapper {
    position: relative;
  }
  
  .username-prefix {
    position: absolute;
    left: 0.9em;
    top: 50%;
    transform: translateY(-50%);
    color: #767d89;
    font-size: 0.95em;
    pointer-events: none;
  }
  
  .username-input {
    padding-left: 2.5em !important;
  }
  
  .username-hint {
    font-size: 0.85em;
    color: #a3a9b4;
    margin-top: 0.5em;
  }
  
  .username-status {
    display: flex;
    align-items: center;
    gap: 0.4em;
    margin-top: 0.5em;
    font-size: 0.9em;
    min-height: 1.4em;
  }
  
  .username-status.checking { color: #a3a9b4; }
  .username-status.available { color: #059669; }
  .username-status.taken { color: #dc2626; }
  .username-status.invalid { color: #d97706; }
  
  .warning-box {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    padding: 1em;
    margin-top: 1.5em;
    font-size: 0.9em;
    color: #92400e;
  }
  
  .warning-box strong {
    display: block;
    margin-bottom: 0.3em;
  }
  
  #claim-btn {
    width: 100%;
    margin-top: 1.5em;
  }
  
  #claim-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }
`;

let currentSession = null;
let checkTimeout = null;
let isAvailable = false;

export async function init() {
  // Inject page-specific styles
  const styleEl = document.createElement('style');
  styleEl.id = 'claim-username-styles';
  styleEl.textContent = pageStyles;
  document.head.appendChild(styleEl);
  
  const form = document.getElementById("username-form");
  const usernameInput = document.getElementById("username");
  const claimBtn = document.getElementById("claim-btn");
  
  // Check if user is logged in
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    window.spaNavigate('/login');
    return;
  }
  
  currentSession = session;
  
  // Check if user already has a username
  try {
    const userData = await users.getMe();
    if (userData.username) {
      // Already has username, redirect to my assets
      window.spaNavigate('/my-assets');
      return;
    }
  } catch {
    // Profile fetch failed — proceed to the claim form
  }
  
  // Set up event listeners
  usernameInput.addEventListener("input", handleUsernameInput);
  form.addEventListener("submit", handleSubmit);
  
  // Return cleanup function
  return () => {
    usernameInput.removeEventListener("input", handleUsernameInput);
    form.removeEventListener("submit", handleSubmit);
    clearTimeout(checkTimeout);
    
    const styleEl = document.getElementById('claim-username-styles');
    if (styleEl) styleEl.remove();
  };
}

function handleUsernameInput(e) {
  const usernameStatus = document.getElementById("username-status");
  const claimBtn = document.getElementById("claim-btn");
  
  // Convert to lowercase and remove invalid characters
  const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (cleaned !== e.target.value) {
    e.target.value = cleaned;
  }
  
  const username = cleaned;
  
  // Clear previous timeout
  clearTimeout(checkTimeout);
  
  if (!username) {
    usernameStatus.textContent = "";
    usernameStatus.className = "username-status";
    claimBtn.disabled = true;
    return;
  }
  
  // Validate format
  const validation = validateUsername(username);
  if (!validation.valid) {
    updateStatus("invalid", validation.message);
    return;
  }
  
  // Show checking status
  updateStatus("checking", "Checking availability...");
  
  // Debounce the availability check
  checkTimeout = setTimeout(async () => {
    const available = await checkAvailability(username);
    
    // Make sure the input hasn't changed
    const currentInput = document.getElementById("username");
    if (currentInput && currentInput.value !== username) return;
    
    if (available === null) {
      updateStatus("invalid", "Error checking availability");
    } else if (available) {
      updateStatus("available", "✓ Username is available!");
    } else {
      updateStatus("taken", "✗ Username is already taken");
    }
  }, 400);
}

async function handleSubmit(e) {
  e.preventDefault();
  
  if (!currentSession || !isAvailable) return;
  
  const usernameInput = document.getElementById("username");
  const claimBtn = document.getElementById("claim-btn");
  const username = usernameInput.value.trim();
  
  claimBtn.disabled = true;
  claimBtn.textContent = "Claiming...";
  
  try {
    await users.claim(username);
    showStatus("success", "Username claimed! Redirecting...");
    // Clear cached profile so the next page fetches the new username
    clearCachedProfile();
    setTimeout(() => {
      window.spaNavigate('/my-assets');
    }, 1000);
  } catch (err) {
    showStatus("error", err.message || "Failed to claim username. Please try again.");
    claimBtn.disabled = false;
    claimBtn.textContent = "Claim Username";
  }
}

// Username validation regex
const usernameRegex = /^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/;

function validateUsername(username) {
  if (username.length < 3) {
    return { valid: false, message: "Must be at least 3 characters" };
  }
  if (username.length > 20) {
    return { valid: false, message: "Must be 20 characters or less" };
  }
  if (!usernameRegex.test(username)) {
    if (username.startsWith("-") || username.startsWith("_") || username.endsWith("-") || username.endsWith("_")) {
      return { valid: false, message: "Cannot start or end with a hyphen or underscore" };
    }
    if (username.includes("--") || username.includes("__") || username.includes("-_") || username.includes("_-")) {
      return { valid: false, message: "Cannot have consecutive special characters" };
    }
    return { valid: false, message: "Only lowercase letters, numbers, hyphens, and underscores" };
  }
  return { valid: true };
}

async function checkAvailability(username) {
  try {
    const data = await users.check(username);
    return data.available;
  } catch {
    return null; // Error checking
  }
}

function updateStatus(type, message) {
  const usernameStatus = document.getElementById("username-status");
  const claimBtn = document.getElementById("claim-btn");
  
  usernameStatus.className = "username-status " + type;
  usernameStatus.textContent = message;
  
  isAvailable = type === "available";
  claimBtn.disabled = !isAvailable;
}

function showStatus(type, message) {
  const output = document.getElementById("output");
  const statusIcon = output.querySelector(".status-icon");
  const statusText = output.querySelector(".status-text");
  
  output.className = "status-message visible " + type;
  statusIcon.textContent = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  statusText.textContent = message;
}
