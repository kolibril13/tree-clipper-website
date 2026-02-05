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

// Handle the OAuth callback
// The URL contains either a code (OAuth) or tokens in hash (magic link)
async function handleCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Check for OAuth errors
  if (errorParam) {
    console.error("Auth error:", errorParam, errorDescription);
    window.location.replace("/?error=" + encodeURIComponent(errorDescription || errorParam));
    return;
  }

  let exchangeError = null;

  // If we have an authorization code, exchange it for a session
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      exchangeError = error;
      console.error("Failed to exchange code:", error);
    }
  }

  // Now check if we have a session (either from code exchange or hash tokens)
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // Successfully authenticated - redirect to home
    window.location.replace("/");
    return;
  }

  // No session obtained - surface the most relevant error
  if (exchangeError) {
    window.location.replace("/?error=" + encodeURIComponent(exchangeError.message));
    return;
  }

  console.error("No session after callback");
  window.location.replace("/?error=auth_failed");
}

handleCallback();
