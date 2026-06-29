import { createRow, listRows, updateRow } from './base.service.js';

export const listStudents = () => listRows('students', '*, classes(name), programmes(name), houses(name)', 'created_at');
export const registerStudent = (payload) => createRow('students', payload);
export const updateStudent = (id, payload) => updateRow('students', id, payload);

