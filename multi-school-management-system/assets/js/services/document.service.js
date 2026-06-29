import { supabase } from '../config/supabase.js';
import { createRow, listRows } from './base.service.js';

export const listDocuments = () => listRows('documents', '*', 'created_at');
export const createDocumentRecord = (payload) => createRow('documents', payload);

export async function uploadDocument(bucket, path, file) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  return data;
}

export function getPublicUrl(bucket, path) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

