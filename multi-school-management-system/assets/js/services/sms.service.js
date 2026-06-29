import { createRow, listRows } from './base.service.js';

export const listSmsLogs = () => listRows('sms_logs', '*', 'created_at');
export const logSms = (payload) => createRow('sms_logs', payload);

