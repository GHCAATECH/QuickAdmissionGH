import { createRow, listRows, updateRow } from './base.service.js';

export const listResults = () => listRows('results', '*, students(full_name, student_id), subjects(name)', 'created_at');
export const saveResult = (payload) => createRow('results', payload);
export const updateResult = (id, payload) => updateRow('results', id, payload);

