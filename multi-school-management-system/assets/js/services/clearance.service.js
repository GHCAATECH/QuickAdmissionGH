import { createRow, listRows, updateRow } from './base.service.js';

export const listClearanceRequests = () => listRows('clearance_requests', '*, students(full_name, student_id)', 'created_at');
export const applyForClearance = (payload) => createRow('clearance_requests', payload);
export const updateClearance = (id, payload) => updateRow('clearance_requests', id, payload);

