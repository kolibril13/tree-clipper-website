import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://msgozdhtfawuadxerkxq.supabase.co",
  "sb_publishable_wnNxDxsZA_SazdahnpMiIg__zR2QQvv",
  {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
    },
  }
);

// Cache for user profile data
let cachedUserProfile = null;
// Promise for in-flight profile fetch to avoid duplicate requests
let profileFetchPromise = null;

// Fetch user profile (username) from our users table
async function fetchUserProfile(accessToken) {
  // Return cached if available
  if (cachedUserProfile) return cachedUserProfile;
  
  // If a fetch is already in progress, wait for it
  if (profileFetchPromise) return profileFetchPromise;
  
  profileFetchPromise = (async () => {
    try {
      const res = await fetch("/api/users/me", {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      if (res.ok) {
        cachedUserProfile = await res.json();
        return cachedUserProfile;
      }
    } catch {
      // Ignore errors
    }
    return null;
  })();
  
  const result = await profileFetchPromise;
  profileFetchPromise = null;
  return result;
}

// Check if user needs to claim a username (redirect if needed)
export async function ensureUsername() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  
  const profile = await fetchUserProfile(session.access_token);
  
  if (!profile || !profile.username) {
    // User doesn't have a username yet, redirect to claim page
    // But not if we're already on the claim page
    if (!window.location.pathname.includes("claim-username")) {
      // Use SPA navigation if available, otherwise fallback to direct navigation
      if (window.spaNavigate) {
        window.spaNavigate('/claim-username');
      } else {
        window.location.href = "/claim-username";
      }
      return false;
    }
  }
  
  return true;
}

function renderLoginCorner(user, profile) {
  const corner = document.querySelector(".login-corner");
  if (!corner) return;

  if (user) {
    // Prefer username from our users table, fallback to provider name or email
    const displayName = profile?.username 
      ? `@${profile.username}`
      : (user.user_metadata?.custom_claims?.global_name ??
         user.user_metadata?.full_name ??
         user.user_metadata?.name ??
         user.email ??
         "Set username");
    
    corner.innerHTML = '';
    corner.insertAdjacentHTML(
      "afterbegin",
      `<a href="/upload-asset" class="upload-link">+ Upload</a><a href="/my-assets" class="login-status"></a><button class="logout-btn">Logout</button>`
    );
    corner.querySelector(".login-status").textContent = displayName;

    corner.querySelector(".logout-btn").addEventListener("click", async () => {
      cachedUserProfile = null;
      await supabase.auth.signOut();
      window.location.reload();
    });
  } else {
    corner.innerHTML = `
      <a href="/upload-asset" class="upload-link">+ Upload</a>
      <button class="login-link">Login</button>
    `;

    corner.querySelector(".login-link").addEventListener("click", (e) => {
      e.stopPropagation();
      showLoginDropdown(e.target);
    });
  }
}

function showLoginDropdown(anchor) {
  // Remove any existing dropdown
  const existing = document.querySelector('.login-dropdown');
  if (existing) {
    existing.remove();
    return;
  }
  
  const dropdown = document.createElement('div');
  dropdown.className = 'login-dropdown';
  dropdown.innerHTML = `
    <div class="login-options">
      <button class="login-option login-option--discord">
        <svg class="login-option-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        Login with Discord
      </button>
      <div class="login-divider"><span>or</span></div>
      <button class="login-option login-option--email">
        <svg class="login-option-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="M22 6L12 13L2 6"/>
        </svg>
        Login with Email
      </button>
    </div>
    <div class="login-email-form" style="display: none;">
      <button class="login-back-btn">&larr; Back</button>
      <p class="login-magic-text">Enter your email and we'll send you a magic link to sign in.</p>
      <form class="magic-link-form">
        <input type="email" name="email" placeholder="Email" required autocomplete="email">
        <div class="login-form-error"></div>
        <button type="submit" class="login-submit-btn">Send Magic Link</button>
      </form>
    </div>
    <div class="login-success-msg" style="display: none;"></div>
  `;
  
  // Position the dropdown
  document.body.appendChild(dropdown);
  
  const rect = anchor.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 8) + 'px';
  dropdown.style.right = (window.innerWidth - rect.right) + 'px';
  
  const optionsView = dropdown.querySelector('.login-options');
  const emailFormView = dropdown.querySelector('.login-email-form');
  const successMsg = dropdown.querySelector('.login-success-msg');
  
  // Handle Discord login
  dropdown.querySelector('.login-option--discord').addEventListener('click', async () => {
    dropdown.remove();
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });
  
  // Handle Email option click
  dropdown.querySelector('.login-option--email').addEventListener('click', () => {
    optionsView.style.display = 'none';
    emailFormView.style.display = 'block';
  });
  
  // Handle back button
  dropdown.querySelector('.login-back-btn').addEventListener('click', () => {
    emailFormView.style.display = 'none';
    successMsg.style.display = 'none';
    optionsView.style.display = 'block';
  });
  
  // Handle magic link form submission
  dropdown.querySelector('.magic-link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const email = form.email.value.trim();
    const errorEl = form.querySelector('.login-form-error');
    const submitBtn = form.querySelector('.login-submit-btn');
    
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      
      // Show success message
      emailFormView.style.display = 'none';
      successMsg.innerHTML = `
        <div class="login-success-content">
          <span class="login-success-icon">✓</span>
          <p>Check your email!</p>
          <p class="login-success-sub">We sent a magic link to <strong>${email}</strong></p>
        </div>
      `;
      successMsg.style.display = 'block';
    } catch (err) {
      errorEl.textContent = err.message || 'An error occurred';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Magic Link';
    }
  });
  
  // Close on outside click
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && e.target !== anchor) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };
  setTimeout(() => document.addEventListener('click', closeDropdown), 0);
}

export async function initLoginCorner() {
  // Get initial state
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  
  let profile = null;
  if (session) {
    profile = await fetchUserProfile(session.access_token);
  }
  
  renderLoginCorner(user, profile);

  // Listen for changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    let profile = null;
    if (session) {
      profile = await fetchUserProfile(session.access_token);
    } else {
      cachedUserProfile = null;
    }
    renderLoginCorner(session?.user ?? null, profile);
  });
}

// Get cached user profile
export function getUserProfile() {
  return cachedUserProfile;
}

// Clear cached profile (called on logout)
export function clearCachedProfile() {
  cachedUserProfile = null;
}

// NOTE: Auto-init removed for SPA architecture
// The router now calls initLoginCorner once when the app loads
