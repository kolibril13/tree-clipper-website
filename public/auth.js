import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://msgozdhtfawuadxerkxq.supabase.co",
  "sb_publishable_wnNxDxsZA_SazdahnpMiIg__zR2QQvv",
  {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
    },
  }
);

export async function initLoginCorner() {
  const corner = document.querySelector(".login-corner");
  if (!corner) return;

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const displayName = user.email ?? user.user_metadata?.full_name ?? "Discord user";
    corner.innerHTML = `
      <span class="login-status">${displayName}</span>
      <button class="logout-btn">Logout</button>
    `;
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

// Auto-init on DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLoginCorner);
} else {
  initLoginCorner();
}
