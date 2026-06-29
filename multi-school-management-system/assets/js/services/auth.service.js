import { ROLE_ROUTES, supabase } from "../config/supabase.js";

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`Your login exists for ${session.user.email} (${session.user.id}), but no readable profile row was found.`);
  }
  if (data.status && data.status !== "Active") {
    throw new Error("This account is not active.");
  }
  return data;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return getCurrentProfile();
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/public/login.html";
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export function routeForRole(role) {
  return ROLE_ROUTES[role] || "/public/login.html";
}

export async function requireRole(allowedRoles = []) {
  const profile = await getCurrentProfile();
  if (!profile) {
    window.location.href = "/public/login.html";
    return null;
  }

  if (allowedRoles.length && !allowedRoles.includes(profile.role)) {
    window.location.href = routeForRole(profile.role);
    return null;
  }

  return profile;
}
