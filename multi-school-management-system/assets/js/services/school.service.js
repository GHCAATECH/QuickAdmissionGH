import { createRow, listRows, updateRow } from './base.service.js';

export const listSchools = () => listRows('schools', '*', 'created_at');
export const createSchool = (payload) => createRow('schools', payload);
export const updateSchool = (id, payload) => updateRow('schools', id, payload);

