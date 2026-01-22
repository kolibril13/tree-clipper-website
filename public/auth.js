import { createClient } from "https://esm.sh/@supabase/supabase-js";

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

// Fetch user profile (username) from our users table
async function fetchUserProfile(accessToken) {
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
      window.location.href = "claim-username.html";
      return false;
    }
  }
  
  return true;
}

function renderLoginCorner(user, profile) {
  const corner = document.querySelector(".login-corner");
  if (!corner) return;

  if (user) {
    // Prefer username from our users table, fallback to Discord name
    const displayName = profile?.username 
      ? `@${profile.username}`
      : (user.user_metadata?.custom_claims?.global_name ??
         user.user_metadata?.full_name ??
         user.user_metadata?.name ??
         "Discord user");
    
    corner.innerHTML = '';
    corner.insertAdjacentHTML(
      "afterbegin",
      `<a href="dashboard.html" class="login-status"></a><button class="logout-btn">Logout</button>`
    );
    corner.querySelector(".login-status").textContent = displayName;

    corner.querySelector(".logout-btn").addEventListener("click", async () => {
      cachedUserProfile = null;
      await supabase.auth.signOut();
      window.location.reload();
    });
  } else {
    corner.innerHTML = `
      <button class="login-btn">Login with Discord</button>
    `;

    corner.querySelector(".login-btn").addEventListener("click", async () => {
      await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    });
  }
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

// auto-init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLoginCorner);
} else {
  initLoginCorner();
}