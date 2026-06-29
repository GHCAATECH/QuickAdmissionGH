export const SUPABASE_URL = "https://rmbghqklbxobtmbcttto.supabase.co";
export const SUPABASE_KEY = "sb_publishable_vSiLXbW0riCpOEDagRXh4g_77onSBUy";

export const ROLE_ROUTES = {
  "Super Admin": "/public/super-admin/index.html",
  "School Administrator": "/public/school-admin/index.html",
  "Management Staff": "/public/management/index.html",
  "House Staff": "/public/house/index.html",
  "Teaching Staff": "/public/staff/index.html",
  "Non-Teaching Staff": "/public/non-teaching/index.html",
  Student: "/public/student/index.html"
};

export const STORAGE_BUCKETS = {
  schoolLogos: "school-logos",
  studentPhotos: "student-photos",
  staffPhotos: "staff-photos",
  documents: "documents",
  clearanceCertificates: "clearance-certificates"
};

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "mss-auth"
  }
});
