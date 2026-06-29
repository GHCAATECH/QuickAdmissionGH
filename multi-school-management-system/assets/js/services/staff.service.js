import { createRow, listRows, updateRow } from './base.service.js';

export const listStaff = () => listRows('staff', '*', 'created_at');
export const addStaff = (payload) => createRow('staff', payload);
export const updateStaff = (id, payload) => updateRow('staff', id, payload);

