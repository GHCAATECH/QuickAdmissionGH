import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const body = await req.json();
  return Response.json({
    generated: true,
    request_id: body.request_id,
    certificate_url: null
  });
});

