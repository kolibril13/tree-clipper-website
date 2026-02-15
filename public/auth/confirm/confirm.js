import { createClient } from "@supabase/supabase-js";

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

// Handle the email confirmation by verifying the token_hash client-side.
// This avoids email link scanners consuming the OTP token at Supabase's
// /auth/v1/verify endpoint before the user clicks the link.
async function handleConfirm() {
  const url = new URL(window.location.href);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type"); // "magiclink", "signup", "email", etc.

  if (!tokenHash || !type) {
    window.location.replace("/?error=" + encodeURIComponent("Invalid confirmation link"));
    return;
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("OTP verification failed:", error);
    window.location.replace("/?error=" + encodeURIComponent(error.message));
    return;
  }

  // Successfully authenticated — redirect to home
  window.location.replace("/");
}

handleConfirm();
