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

// Username validation
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/;

function isValidUsername(username) {
  if (!username || typeof username !== "string") return false;
  if (username.length < 3 || username.length > 20) return false;
  if (!USERNAME_REGEX.test(username)) return false;
  if (username.includes("--") || username.includes("__") || username.includes("-_") || username.includes("_-")) return false;
  return true;
}

// Generate URL-safe slug from title
function generateSlug(title) {
  if (!title) return null;
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-")          // Spaces to hyphens
    .replace(/-+/g, "-")           // Collapse multiple hyphens
    .replace(/^-|-$/g, "")         // Trim hyphens from ends
    .slice(0, 50);                 // Limit length
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Check if this is a /:username/:slug route (not /api, not a file with extension)
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    // /:username - user profile page
    if (
      pathParts.length === 1 &&
      !url.pathname.startsWith("/api") &&
      !pathParts[0].includes(".")
    ) {
      // This looks like /:username - serve user.html but keep the original URL
      const userHtmlResponse = await env.ASSETS.fetch(new Request(new URL("/user.html", url.origin)));
      
      return new Response(userHtmlResponse.body, {
        status: userHtmlResponse.status,
        headers: userHtmlResponse.headers
      });
    }
    
    // /:username/:slug - asset page
    if (
      pathParts.length === 2 &&
      !url.pathname.startsWith("/api") &&
      !pathParts[1].includes(".")
    ) {
      // This looks like /:username/:slug - serve asset.html but keep the original URL
      // Fetch asset.html from assets, but return it for the current URL
      const assetHtmlResponse = await env.ASSETS.fetch(new Request(new URL("/asset.html", url.origin)));
      
      // Return the HTML with the same headers but for the original URL
      return new Response(assetHtmlResponse.body, {
        status: assetHtmlResponse.status,
        headers: assetHtmlResponse.headers
      });
    }
    
    // Let static assets be served by the assets handler
    if (!url.pathname.startsWith("/api")) {
      return env.ASSETS.fetch(request);
    }
    
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

    // ========== USER ROUTES ==========
    
    // GET /api/users/me - Get current user's profile
    if (url.pathname === "/api/users/me" && request.method === "GET") {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }
      
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userData.user.id)
        .single();
      
      if (error) {
        // User doesn't exist in users table yet
        if (error.code === "PGRST116") {
          return Response.json({ id: userData.user.id, username: null });
        }
        return new Response(error.message, { status: 500 });
      }
      
      return Response.json(data);
    }
    
    // GET /api/users/check?username=xxx - Check if username is available
    if (url.pathname === "/api/users/check" && request.method === "GET") {
      const username = url.searchParams.get("username")?.toLowerCase();
      
      if (!username) {
        return Response.json({ available: false, error: "Missing username" });
      }
      
      if (!isValidUsername(username)) {
        return Response.json({ available: false, error: "Invalid username format" });
      }
      
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .single();
      
      // PGRST116 means no rows found = username is available
      const available = error?.code === "PGRST116";
      
      return Response.json({ available });
    }
    
    // POST /api/users/claim - Claim a username
    if (url.pathname === "/api/users/claim" && request.method === "POST") {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }
      
      // Check if user already has a username
      const { data: existingUser } = await supabase
        .from("users")
        .select("username")
        .eq("id", userData.user.id)
        .single();
      
      if (existingUser?.username) {
        return new Response("You already have a username", { status: 400 });
      }
      
      const body = await request.json();
      const username = body.username?.toLowerCase()?.trim();
      
      if (!isValidUsername(username)) {
        return new Response("Invalid username format", { status: 400 });
      }
      
      // Try to insert/upsert the user with username
      const { error } = await supabase
        .from("users")
        .upsert({
          id: userData.user.id,
          username: username,
          created_at: new Date().toISOString()
        }, {
          onConflict: "id"
        });
      
      if (error) {
        // Unique constraint violation = username taken
        if (error.code === "23505") {
          return new Response("Username is already taken", { status: 409 });
        }
        return new Response(error.message, { status: 500 });
      }
      
      return new Response("Username claimed ✅", { status: 201 });
    }
    
    // GET /api/users/:username - Get user by username (public)
    if (url.pathname.startsWith("/api/users/") && request.method === "GET") {
      const username = url.pathname.split("/api/users/")[1];
      
      if (!username || username === "me" || username === "check") {
        // These are handled above
        return new Response("Not found", { status: 404 });
      }
      
      const { data, error } = await supabase
        .from("users")
        .select("id, username, created_at")
        .eq("username", username.toLowerCase())
        .single();
      
      if (error) {
        return new Response("User not found", { status: 404 });
      }
      
      return Response.json(data);
    }
    
    // ========== SLUG AVAILABILITY CHECK ==========
    // GET /api/slug/check?title=xxx - Check if slug is available for current user
    if (url.pathname === "/api/slug/check" && request.method === "GET") {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }
      
      // Get username from users table
      const { data: userProfile } = await supabase
        .from("users")
        .select("username")
        .eq("id", userData.user.id)
        .single();

      if (!userProfile?.username) {
        return Response.json({ available: false, error: "Please set a username first" });
      }

      const title = url.searchParams.get("title");
      if (!title) {
        return Response.json({ available: false, error: "Missing title" });
      }

      // Generate slug from title
      const baseSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50);

      if (!baseSlug) {
        return Response.json({ available: false, slug: "", error: "Invalid title" });
      }

      // Check if base slug exists for this user
      const { data: existing } = await supabase
        .from("entries")
        .select("slug")
        .eq("author", userProfile.username)
        .eq("slug", baseSlug)
        .single();

      if (!existing) {
        // Base slug is available
        return Response.json({ 
          available: true, 
          slug: baseSlug,
          author: userProfile.username
        });
      }

      // Find next available slug with suffix
      let suffix = 1;
      let availableSlug = `${baseSlug}-${suffix}`;
      
      while (suffix <= 100) {
        const { data: check } = await supabase
          .from("entries")
          .select("slug")
          .eq("author", userProfile.username)
          .eq("slug", availableSlug)
          .single();
        
        if (!check) break;
        
        suffix++;
        availableSlug = `${baseSlug}-${suffix}`;
      }

      return Response.json({ 
        available: false, 
        slug: baseSlug,
        availableSlug,
        author: userProfile.username
      });
    }

    // ========== ASSET BY USERNAME/SLUG ==========
    // GET /api/asset/:username/:slug - Get asset by username and slug
    if (url.pathname.startsWith("/api/asset/") && request.method === "GET") {
      const parts = url.pathname.split("/api/asset/")[1]?.split("/");
      
      if (parts?.length === 2) {
        const [username, slug] = parts.map(p => decodeURIComponent(p).toLowerCase());
        
        const { data, error } = await supabase
          .from("entries")
          .select("*")
          .eq("author", username)
          .eq("slug", slug)
          .single();
        
        if (error) {
          return new Response("Asset not found", { status: 404 });
        }
        
        return Response.json(data);
      }
    }

    // ---------- PUBLIC READ ----------
    if (request.method === "GET") {
      const mine = url.searchParams.get("mine");
      const authorFilter = url.searchParams.get("author");

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

      // Get entries by author username
      if (authorFilter) {
        const { data, error } = await supabase
          .from("entries")
          .select("*")
          .eq("author", authorFilter.toLowerCase())
          .order("creation_date", { ascending: false });

        if (error) {
          return new Response(error.message, { status: 500 });
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

      // Get username from users table
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("username")
        .eq("id", userData.user.id)
        .single();

      if (profileError || !userProfile?.username) {
        return new Response("Please set a username first", { status: 400 });
      }

      const body = await request.json();
      if (!body?.assetData) {
        return new Response("Missing assetData", { status: 400 });
      }
      
      if (!body?.title?.trim()) {
        return new Response("Title is required", { status: 400 });
      }

      const now = new Date().toISOString();
      const author = userProfile.username;
      
      // Generate slug from title
      let baseSlug = generateSlug(body.title);
      if (!baseSlug) {
        return new Response("Invalid title", { status: 400 });
      }
      
      // Check if slug already exists for this user, if so add a number
      let slug = baseSlug;
      let suffix = 1;
      while (true) {
        const { data: existing } = await supabase
          .from("entries")
          .select("slug")
          .eq("author", author)
          .eq("slug", slug)
          .single();
        
        if (!existing) break; // Slug is available
        
        suffix++;
        slug = `${baseSlug}-${suffix}`;
        
        if (suffix > 100) {
          return new Response("Could not generate unique slug", { status: 500 });
        }
      }
      
      const { error } = await supabase
        .from("entries")
        .insert({
          user_id: userData.user.id,
          slug,
          author,
          asset_data: body.assetData,
          title: body.title.trim(),
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

      return Response.json({ slug, author }, { status: 201 });
    }

    // ---------- AUTH UPDATE ----------
    if (request.method === "PUT") {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const username = url.searchParams.get("author");
      const slug = url.searchParams.get("slug");
      
      if (!username || !slug) {
        return new Response("Missing author or slug", { status: 400 });
      }

      // Check ownership and get current image
      const { data: existing, error: fetchError } = await supabase
        .from("entries")
        .select("user_id, image_data, slug, author")
        .eq("author", username)
        .eq("slug", slug)
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

      // Title cannot be changed (it determines the URL slug)
      // if (body.title !== undefined) - NOT ALLOWED
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
        .eq("author", existing.author)
        .eq("slug", existing.slug);

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

      const username = url.searchParams.get("author");
      const slug = url.searchParams.get("slug");
      
      if (!username || !slug) {
        return new Response("Missing author or slug", { status: 400 });
      }

      // Check ownership and get image URL
      const { data: existing, error: fetchError } = await supabase
        .from("entries")
        .select("user_id, image_data, slug, author")
        .eq("author", username)
        .eq("slug", slug)
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
        .eq("author", existing.author)
        .eq("slug", existing.slug);

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response("Asset deleted ✅", { status: 200 });
    }

    return new Response("Method not allowed", { status: 405 });
  }
};