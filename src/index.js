import { createClient } from "@supabase/supabase-js";

export default {
  async fetch(request, env) {
    const authHeader = request.headers.get("Authorization");

    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_KEY,
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {}
        }
      }
    );

    // ---------- PUBLIC READ ----------
    if (request.method === "GET") {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("creation_date", { ascending: false });

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return Response.json(data);
    }

    // ---------- AUTH WRITE ----------
    if (request.method === "POST") {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const body = await request.json();
      if (!body?.assetData) {
        return new Response("Missing assetData", { status: 400 });
      }

      const now = new Date().toISOString();
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const author =
        userData.user.user_metadata?.full_name ||
        userData.user.user_metadata?.name ||
        userData.user.email;

      const { error } = await supabase
        .from("entries")
        .insert({
          user_id: userData.user.id,
          asset_id: assetId,
          author,
          asset_data: body.assetData,
          title: body.title,
          description: body.description,
          image_data: body.imageData,
          creation_date: now,
          last_update: now
        });

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response("Asset inserted ✅", { status: 201 });
    }

    return new Response("Method not allowed", { status: 405 });
  }
};