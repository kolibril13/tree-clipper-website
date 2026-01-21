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

function renderLoginCorner(user) {
  const corner = document.querySelector(".login-corner");
  if (!corner) return;

  if (user) {
    const displayName =
      user.user_metadata?.custom_claims?.global_name ??
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      "Discord user";
    corner.innerHTML = '';
    corner.insertAdjacentHTML(
      "afterbegin",
      `<a href="dashboard.html" class="login-status"></a><button class="logout-btn">Logout</button>`
    );
    corner.querySelector(".login-status").textContent = displayName;

    corner.querySelector(".logout-btn").addEventListener("click", async () => {
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
  const { data: { user } } = await supabase.auth.getUser();
  renderLoginCorner(user);

  // Listen for changes
  supabase.auth.onAuthStateChange((event, session) => {
    renderLoginCorner(session?.user ?? null);
  });
}

// auto-init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLoginCorner);
} else {
  initLoginCorner();
}