import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(url, serviceKey);
  const body = await req.json();
  const { data, error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
  return Response.json({ data, error }, { status: error ? 400 : 200 });
});

