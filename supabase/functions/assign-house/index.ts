import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { guardRequest, jsonResponse } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function safeText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function upperText(value: unknown): string {
  return safeText(value).toUpperCase();
}

function normalizeGender(value: unknown): string {
  const text = upperText(value);
  if (text === "M" || text === "MALE") return "MALE";
  if (text === "F" || text === "FEMALE") return "FEMALE";
  return "";
}

function normalizeResidential(value: unknown): string {
  const text = upperText(value).replace(/\s+/g, "");
  if (text === "D" || text === "DAY") return "DAY";
  if (text === "B" || text === "BOARDING") return "BOARDING";
  return "";
}

function genderMatches(houseGender: unknown, studentGender: string): boolean {
  const target = normalizeGender(houseGender);
  if (!target || !studentGender) return true;
  return target === studentGender;
}

function residentialMatches(houseResidential: unknown, studentResidential: string): boolean {
  const target = normalizeResidential(houseResidential);
  if (studentResidential === "DAY") return target === "DAY";
  if (studentResidential === "BOARDING") return !target || target === "BOARDING";
  return true;
}

Deno.serve(async (req: Request) => {
  const blocked = guardRequest(req, { maxBodyBytes: 4_096 });
  if (blocked) return blocked;
  const json = (body: Record<string, unknown>, status = 200) => jsonResponse(req, body, status);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "not_configured", message: "Supabase service credentials are missing." }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const index = safeText(body.index ?? body.p_index);
  const token = upperText(body.token ?? body.p_token);
  const schoolId = safeText(body.school ?? body.p_school) || null;

  if (!index) return json({ ok: false, error: "index", message: "Index number is required." }, 400);
  if (!token) return json({ ok: false, error: "token", message: "Admission token is required." }, 400);

  let studentQuery = admin
    .from("students")
    .select("id, school_id, bece_index, full_name, admission_token, house_id, gender, submitted_at")
    .eq("bece_index", index);
  if (schoolId) studentQuery = studentQuery.eq("school_id", schoolId);

  const { data: studentRows, error: studentError } = await studentQuery;
  if (studentError) return json({ ok: false, error: "lookup_failed", message: studentError.message }, 500);

  const students = Array.isArray(studentRows) ? studentRows : [];
  if (!students.length) return json({ ok: false, error: "index", message: "Student was not found." }, 404);
  if (students.length > 1) return json({ ok: false, error: "ambiguous", message: "This index belongs to more than one school." }, 409);

  const student = students[0] as Record<string, unknown>;
  if (upperText(student.admission_token) !== token) {
    return json({ ok: false, error: "token", message: "Admission token is invalid." }, 401);
  }

  const sid = safeText(student.school_id);
  if (!sid) return json({ ok: false, error: "school", message: "Student has no school record." }, 500);
  if (!student.submitted_at) {
    return json({ ok: false, status: "not_submitted", error: "not_submitted", message: "The personal record form has not been submitted yet." }, 409);
  }

  if (student.house_id) {
    const { data: assignedHouse } = await admin
      .from("houses")
      .select("id, name")
      .eq("id", String(student.house_id))
      .maybeSingle();
    return json({
      ok: true,
      status: "already_assigned",
      student_id: student.id,
      school_id: sid,
      index,
      house_id: student.house_id,
      house_name: safeText(assignedHouse?.name),
    });
  }

  const [placementRes, housesRes, occupancyRes] = await Promise.all([
    admin
      .from("placement_list")
      .select("residential_status, gender")
      .eq("school_id", sid)
      .eq("index_number", index)
      .maybeSingle(),
    admin
      .from("houses")
      .select("id, name, capacity, gender, residential_type")
      .eq("school_id", sid)
      .order("name"),
    admin.from("students").select("house_id").eq("school_id", sid),
  ]);

  if (placementRes.error) return json({ ok: false, error: "placement_lookup_failed", message: placementRes.error.message }, 500);
  if (housesRes.error) return json({ ok: false, error: "house_lookup_failed", message: housesRes.error.message }, 500);
  if (occupancyRes.error) return json({ ok: false, error: "occupancy_lookup_failed", message: occupancyRes.error.message }, 500);

  const placement = (placementRes.data ?? {}) as Record<string, unknown>;
  const studentGender = normalizeGender(student.gender || placement.gender);
  const residential = normalizeResidential(placement.residential_status);

  const occupancy = new Map<string, number>();
  for (const row of occupancyRes.data ?? []) {
    const houseId = safeText((row as Record<string, unknown>).house_id);
    if (!houseId) continue;
    occupancy.set(houseId, (occupancy.get(houseId) ?? 0) + 1);
  }

  const allHouses = (housesRes.data ?? []) as Record<string, unknown>[];
  let eligible = allHouses.filter((house) => genderMatches(house.gender, studentGender));

  if (residential === "DAY") {
    eligible = eligible.filter((house) => normalizeResidential(house.residential_type) === "DAY");
    if (!eligible.length) {
      return json({
        ok: false,
        status: "no_day_house",
        error: "no_day_house",
        message: "No day house is configured for this school yet.",
      }, 409);
    }
  } else if (residential === "BOARDING") {
    const matched = eligible.filter((house) => residentialMatches(house.residential_type, residential));
    if (matched.length) eligible = matched;
  }

  const ranked = eligible
    .map((house) => {
      const houseId = safeText(house.id);
      const capacityValue = Number(house.capacity ?? 0);
      const capacity = Number.isFinite(capacityValue) ? capacityValue : 0;
      const occupied = occupancy.get(houseId) ?? 0;
      const unlimited = capacity <= 0;
      const seats = unlimited ? Number.MAX_SAFE_INTEGER : Math.max(capacity - occupied, 0);
      return { house, houseId, occupied, capacity, seats, unlimited };
    })
    .filter((entry) => entry.unlimited || entry.seats > 0);

  if (!ranked.length) {
    return json({
      ok: false,
      status: "no_available_house",
      error: "no_available_house",
      message: "No house with available space matches this student yet.",
    }, 409);
  }

  const chosen = ranked[0];
  const { data: updatedRows, error: updateError } = await admin
    .from("students")
    .update({ house_id: chosen.houseId })
    .eq("id", String(student.id))
    .is("house_id", null)
    .select("id, house_id");

  if (updateError) {
    return json({ ok: false, error: "assign_failed", message: updateError.message }, 500);
  }

  if (!updatedRows || !updatedRows.length) {
    const { data: currentStudent } = await admin
      .from("students")
      .select("house_id")
      .eq("id", String(student.id))
      .maybeSingle();
    if (currentStudent?.house_id) {
      const { data: currentHouse } = await admin
        .from("houses")
        .select("id, name")
        .eq("id", String(currentStudent.house_id))
        .maybeSingle();
      return json({
        ok: true,
        status: "already_assigned",
        student_id: student.id,
        school_id: sid,
        index,
        house_id: currentStudent.house_id,
        house_name: safeText(currentHouse?.name),
      });
    }
    return json({ ok: false, error: "assign_failed", message: "Could not update the student house." }, 500);
  }

  return json({
    ok: true,
    status: "assigned",
    student_id: student.id,
    school_id: sid,
    index,
    house_id: chosen.houseId,
    house_name: safeText(chosen.house.name),
    gender: studentGender,
    residential,
  });
});
