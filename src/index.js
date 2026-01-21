import { createClient } from "@supabase/supabase-js";

// Extract storage path from a Supabase public URL
function getStoragePathFromUrl(imageUrl, bucketName) {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    // URL format: .../storage/v1/object/public/bucket-name/path/to/file
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length));
    }
  } catch {
    // Invalid URL
  }
  return null;
}

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

    const url = new URL(request.url);

    // ---------- PUBLIC READ ----------
    if (request.method === "GET") {
      const assetId = url.searchParams.get("id");
      const mine = url.searchParams.get("mine");

      // Get current user's assets only
      if (mine === "true") {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError || !userData?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data, error } = await supabase
          .from("entries")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("creation_date", { ascending: false });

        if (error) {
          return new Response(error.message, { status: 500 });
        }

        return Response.json(data);
      }

      // Single asset lookup by ID
      if (assetId) {
        const { data, error } = await supabase
          .from("entries")
          .select("*")
          .eq("asset_id", assetId)
          .single();

        if (error) {
          return new Response(error.message, { status: error.code === "PGRST116" ? 404 : 500 });
        }

        return Response.json(data);
      }

      // List all entries
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("creation_date", { ascending: false });

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return Response.json(data);
    }

    // ---------- AUTH CREATE ----------
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
        userData.user.user_metadata?.custom_claims?.global_name ||
        userData.user.user_metadata?.full_name ||
        userData.user.user_metadata?.name ||
        "Discord user";

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
          node_type: body.nodeType || null,
          blender_version: body.blenderVersion || null,
          treeclipper_version: body.treeclipperVersion || null,
          creation_date: now,
          last_update: now
        });

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response("Asset inserted ✅", { status: 201 });
    }

    // ---------- AUTH UPDATE ----------
    if (request.method === "PUT") {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const assetId = url.searchParams.get("id");
      if (!assetId) {
        return new Response("Missing asset ID", { status: 400 });
      }

      // Check ownership and get current image
      const { data: existing, error: fetchError } = await supabase
        .from("entries")
        .select("user_id, image_data")
        .eq("asset_id", assetId)
        .single();

      if (fetchError) {
        return new Response("Asset not found", { status: 404 });
      }

      if (existing.user_id !== userData.user.id) {
        return new Response("Forbidden", { status: 403 });
      }

      const body = await request.json();
      const updates = {
        last_update: new Date().toISOString()
      };

      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.assetData !== undefined) updates.asset_data = body.assetData;
      if (body.imageData !== undefined) updates.image_data = body.imageData;
      if (body.nodeType !== undefined) updates.node_type = body.nodeType;
      if (body.blenderVersion !== undefined) updates.blender_version = body.blenderVersion;
      if (body.treeclipperVersion !== undefined) updates.treeclipper_version = body.treeclipperVersion;

      // Delete old image from storage if it's being replaced or removed
      if (body.imageData !== undefined && existing.image_data && existing.image_data !== body.imageData) {
        const oldPath = getStoragePathFromUrl(existing.image_data, "asset-images");
        if (oldPath) {
          await supabase.storage.from("asset-images").remove([oldPath]);
        }
      }

      const { error } = await supabase
        .from("entries")
        .update(updates)
        .eq("asset_id", assetId);

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response("Asset updated ✅", { status: 200 });
    }

    // ---------- AUTH DELETE ----------
    if (request.method === "DELETE") {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const assetId = url.searchParams.get("id");
      if (!assetId) {
        return new Response("Missing asset ID", { status: 400 });
      }

      // Check ownership and get image URL
      const { data: existing, error: fetchError } = await supabase
        .from("entries")
        .select("user_id, image_data")
        .eq("asset_id", assetId)
        .single();

      if (fetchError) {
        return new Response("Asset not found", { status: 404 });
      }

      if (existing.user_id !== userData.user.id) {
        return new Response("Forbidden", { status: 403 });
      }

      // Delete image from storage if it exists
      if (existing.image_data) {
        const imagePath = getStoragePathFromUrl(existing.image_data, "asset-images");
        if (imagePath) {
          await supabase.storage.from("asset-images").remove([imagePath]);
        }
      }

      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("asset_id", assetId);

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response("Asset deleted ✅", { status: 200 });
    }

    return new Response("Method not allowed", { status: 405 });
  }
};