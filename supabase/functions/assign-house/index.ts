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

async function rateAllowed(admin: ReturnType<typeof createClient>, key: string, limit: number, seconds: number) {
  const { data, error } = await admin.rpc("consume_api_rate_limit", { p_bucket_key: key, p_limit: limit, p_window_seconds: seconds });
  return !!error || data?.allowed !== false;
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
  return !!target && !!studentGender && target === studentGender;
}

function residentialMatches(houseResidential: unknown, studentResidential: string): boolean {
  const target = normalizeResidential(houseResidential);
  return !!target && !!studentResidential && target === studentResidential;
}

function parseFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTimestamp(value: unknown): number | null {
  const text = safeText(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function housePriorityRank(house: Record<string, unknown>): number {
  const numericKeys = [
    "priority",
    "sort_order",
    "sortOrder",
    "display_order",
    "displayOrder",
    "order_no",
    "orderNo",
    "order_index",
    "position",
    "rank",
  ];
  for (const key of numericKeys) {
    const numeric = parseFiniteNumber(house[key]);
    if (numeric != null) return numeric;
  }
  const createdAt = parseTimestamp(house.created_at ?? house.createdAt);
  if (createdAt != null) return createdAt;
  return Number.MAX_SAFE_INTEGER;
}

function houseOrderCompare(
  left: { house: Record<string, unknown>; houseId: string },
  right: { house: Record<string, unknown>; houseId: string },
): number {
  const priorityDiff = housePriorityRank(left.house) - housePriorityRank(right.house);
  if (priorityDiff !== 0) return priorityDiff;
  const nameDiff = safeText(left.house.name).localeCompare(safeText(right.house.name), undefined, {
    sensitivity: "base",
  });
  if (nameDiff !== 0) return nameDiff;
  return left.houseId.localeCompare(right.houseId);
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
  const forwarded = safeText(req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip"));
  const ip = (forwarded.split(",")[0] || "unknown").trim().slice(0, 80);
  if (!await rateAllowed(admin, `assign-house:ip:${ip}`, 60, 60) || !await rateAllowed(admin, `assign-house:student:${schoolId || "all"}:${index}`, 10, 60)) {
    return json({ ok: false, error: "rate_limited", message: "Too many house-assignment requests. Please wait a minute and try again." }, 429);
  }

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
      .select("id, name, capacity, gender, residential_type, priority, created_at")
      .eq("school_id", sid),
    admin.rpc("house_occupancy_counts", { p_school_id: sid }),
  ]);

  if (placementRes.error) return json({ ok: false, error: "placement_lookup_failed", message: placementRes.error.message }, 500);
  if (housesRes.error) return json({ ok: false, error: "house_lookup_failed", message: housesRes.error.message }, 500);
  if (occupancyRes.error) return json({ ok: false, error: "occupancy_lookup_failed", message: occupancyRes.error.message }, 500);

  const placement = (placementRes.data ?? {}) as Record<string, unknown>;
  const studentGender = normalizeGender(student.gender || placement.gender);
  const residential = normalizeResidential(placement.residential_status);
  if (!studentGender) {
    return json({ ok: false, status: "gender_required", error: "gender_required", message: "Set the student's gender before assigning a house." }, 409);
  }
  if (!residential) {
    return json({ ok: false, status: "residential_required", error: "residential_required", message: "Set the student's residential status to Boarding or Day before assigning a house." }, 409);
  }

  const occupancy = new Map<string, number>();
  for (const row of occupancyRes.data ?? []) {
    const houseId = safeText((row as Record<string, unknown>).house_id);
    if (!houseId) continue;
    const occupied = Number((row as Record<string, unknown>).occupied ?? 0);
    occupancy.set(houseId, Number.isFinite(occupied) ? occupied : 0);
  }

  const allHouses = (housesRes.data ?? []) as Record<string, unknown>[];
  const eligible = allHouses.filter((house) =>
    genderMatches(house.gender, studentGender) &&
    residentialMatches(house.residential_type, residential) &&
    housePriorityRank(house) !== Number.MAX_SAFE_INTEGER
  );
  if (!eligible.length) {
    return json({
      ok: false,
      status: "no_matching_house",
      error: "no_matching_house",
      message: `No ${residential.toLowerCase()} house is configured for ${studentGender === "MALE" ? "male" : "female"} students yet.`,
    }, 409);
  }

  const ranked = eligible
    .map((house) => {
      const houseId = safeText(house.id);
      const capacityValue = Number(house.capacity ?? 0);
      const capacity = Number.isFinite(capacityValue) ? capacityValue : 0;
      const occupied = occupancy.get(houseId) ?? 0;
      const seats = Math.max(capacity - occupied, 0);
      return { house, houseId, occupied, capacity, seats };
    })
    .filter((entry) => entry.capacity > 0 && entry.seats > 0)
    .sort(houseOrderCompare);

  if (!ranked.length) {
    return json({
      ok: false,
      status: "no_available_house",
      error: "no_available_house",
      message: "No house with available space matches this student yet.",
    }, 409);
  }

  let chosen: (typeof ranked)[number] | null = null;
  for (const candidate of ranked) {
    const { data: updatedRows, error: updateError } = await admin
      .from("students")
      .update({ house_id: candidate.houseId })
      .eq("id", String(student.id))
      .is("house_id", null)
      .select("id, house_id");

    if (updateError) {
      if (updateError.code === "23514" && /capacity/i.test(updateError.message ?? "")) continue;
      return json({ ok: false, error: "assign_failed", message: updateError.message }, 500);
    }

    if (updatedRows?.length) {
      chosen = candidate;
      break;
    }

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
  }

  if (!chosen) {
    return json({ ok: false, status: "no_available_house", error: "no_available_house", message: "All matching houses have reached capacity." }, 409);
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
    allocation_mode: "priority-gender-residential",
  });
});
