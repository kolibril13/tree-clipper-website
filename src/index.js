import { createClient } from "@supabase/supabase-js";

export default {
  async fetch(request, env) {
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_KEY
    );

    if (request.method === "GET") {
      const { data, error } = await supabase
        .from("countries")
        .select("*");

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method === "POST") {
      const body = await request.json();

      const { error } = await supabase
        .from("countries")
        .insert({ name: body.name });

      if (error) {
        return new Response(error.message, { status: 500 });
      }

      return new Response("Inserted ✅", { status: 201 });
    }

    return new Response("Method not allowed", { status: 405 });
  }
};