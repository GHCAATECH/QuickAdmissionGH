import { supabase } from "../config/supabase.js";

export async function listRows(table, columns = "*", orderBy = "created_at") {
  const { data, error } = await supabase.from(table).select(columns).order(orderBy, { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function countRows(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

export async function createRow(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, payload) {
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
