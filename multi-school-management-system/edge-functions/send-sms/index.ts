import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const body = await req.json();
  return Response.json({
    queued: true,
    provider: "configure-sms-provider",
    recipient: body.recipient,
    message: body.message
  });
});

