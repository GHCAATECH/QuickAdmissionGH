import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

// House allocation used to be callable by a student immediately after form
// submission. Allocation is now performed atomically by
// verify_campus_student_backend after an authorized campus verification.
Deno.serve((req: Request) => {
  const blocked = guardRequest(req, { maxBodyBytes: 4_096 });
  if (blocked) return blocked;

  return jsonResponse(req, {
    ok: false,
    error: "campus_verification_required",
    message: "House allocation is completed by an authorized administrator during campus verification.",
  }, 403);
});
