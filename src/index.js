import { createClient } from "@supabase/supabase-js";

export default {
  async fetch(request, env) {
    // Forward auth header (if present)
    const authHeader = request.headers.get("Authorization");

    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_KEY,
      {
        global: {
          headers: authHeader
            ? { Authorization: authHeader }
            : {}
        }
      }
    );

    // PUBLIC READ
    if (request.method === "GET") {
      const { data, error } = await supabase
        .from("entries")
        .select("id, asset_id, author, creation_date, last_update, asset_data, title, image_data, description, user_id")
        .order("creation_date", { ascending: false });

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // AUTHENTICATED WRITE
    if (request.method === "POST") {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const body = await request.json();

      // Validate required fields
      if (!body?.assetData) {
        return new Response("Missing required field: assetData", { status: 400 });
      }

      const now = new Date().toISOString().split("T")[0];
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const author = userData.user.user_metadata?.full_name 
        || userData.user.user_metadata?.name 
        || userData.user.email 
        || "Unknown";

      const { error } = await supabase
        .from("entries")
        .insert({
          user_id: userData.user.id,
          asset_id: assetId,
          author: author,
          creation_date: now,
          last_update: now,
          asset_data: body.assetData,
          title: body.title || null,
          image_data: body.imageData || null,
          description: body.description || null
        });

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response("Asset inserted ✅", { status: 201 });
    }

    return new Response("Method not allowed", { status: 405 });
  }
};