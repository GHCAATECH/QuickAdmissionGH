import { STORAGE_BUCKETS } from "../config/supabase.js";

export const roleModules = {
  "Super Admin": ["schools", "profiles", "roles", "permissions", "sms_logs", "audit_logs", "login_history", "system_settings", "clearance_requests"],
  "School Administrator": ["students", "staff", "classes", "programmes", "houses", "departments", "subjects", "grading_systems", "assessments", "results", "transcripts", "documents", "announcements", "sms_settings", "sms_logs", "clearance_workflows", "clearance_categories", "clearance_officers", "clearance_requests", "school_settings"],
  "Management Staff": ["staff", "students", "school_statistics", "attendance", "documents", "announcements", "clearance_requests"],
  "House Staff": ["students", "houses", "attendance", "documents", "announcements", "clearance_requests", "clearance_approvals"],
  "Teaching Staff": ["assignments", "assessments", "results", "attendance", "scheme_of_work", "lesson_notes", "documents", "announcements"],
  "Non-Teaching Staff": ["documents", "announcements"],
  Student: ["student_profile", "results", "transcripts", "report_cards", "documents", "announcements", "clearance_requests"]
};

export const selectOptions = {
  role: ["Super Admin", "School Administrator", "Management Staff", "House Staff", "Teaching Staff", "Non-Teaching Staff", "Student"],
  status: ["Active", "Inactive", "Suspended", "Draft", "Published", "Pending", "In Progress", "Approved", "Rejected", "Completed", "Queued", "Sent", "Failed"],
  gender: ["Male", "Female"],
  residential_status: ["Day", "Boarding"],
  audience: ["Students", "Staff", "Class", "House", "Whole School"],
  assigned_to: ["Student", "Staff", "Class", "House", "Whole School"],
  sms_type: ["Bulk SMS", "Admission SMS", "Result SMS", "Announcement SMS", "Birthday SMS", "Clearance SMS", "Registration SMS"],
  final_status: ["Pending", "In Progress", "Approved", "Rejected", "Completed"],
  attendance_status: ["Present", "Absent", "Late", "Excused"],
  subscription_plan: ["Trial", "Monthly", "Termly", "Annual"],
  staff_role: ["Management Staff", "House Staff", "Teaching Staff", "Non-Teaching Staff"],
  send_sms: ["false", "true"],
  dark_mode_default: ["false", "true"]
};

export const modules = {
  schools: {
    table: "schools",
    label: "Schools",
    icon: "fa-building-columns",
    bucket: STORAGE_BUCKETS.schoolLogos,
    fileField: "logo_url",
    fields: [["school_name", "text", true], ["school_code", "text", true], ["logo_url", "file"], ["address", "textarea"], ["gps_address"], ["phone"], ["email", "email"], ["website", "url"], ["sms_sender_id"], ["academic_year"], ["subscription_plan", "select"], ["subscription_expires_at", "date"], ["status", "select"]],
    columns: ["school_name", "school_code", "phone", "email", "academic_year", "subscription_plan", "status"],
    bulkActions: ["create-school-admin", "subscription-report"]
  },
  profiles: {
    table: "profiles",
    label: "Users / School Admins",
    icon: "fa-users-gear",
    edgeCreate: true,
    fields: [["school_id", "school-select", true], ["full_name", "text", true], ["email", "email", true], ["phone"], ["password", "password", true], ["role", "select", true], ["status", "select"]],
    editFields: [["school_id", "school-select"], ["full_name", "text", true], ["email", "email", true], ["phone"], ["role", "select", true], ["status", "select"]],
    columns: ["full_name", "email", "phone", "role", "school_id", "status"],
    actions: ["reset-password"],
    bulkActions: ["create-school-admin", "create-staff-user", "create-student-user"]
  },
  roles: { table: "roles", label: "Roles", icon: "fa-user-shield", fields: [["name", "text", true], ["description", "textarea"], ["status", "select"]], columns: ["name", "description", "status"] },
  permissions: { table: "permissions", label: "Permissions", icon: "fa-key", fields: [["module", "text", true], ["action", "text", true], ["status", "select"]], columns: ["module", "action", "status"] },
  students: {
    table: "students",
    label: "Students",
    icon: "fa-user-graduate",
    bucket: STORAGE_BUCKETS.studentPhotos,
    fileField: "photo_url",
    fields: [["full_name", "text", true], ["student_id", "text", true], ["photo_url", "file"], ["gender", "select"], ["residential_status", "select"], ["academic_year"], ["phone"], ["email", "email"], ["admission_date", "date"], ["status", "select"]],
    columns: ["full_name", "student_id", "gender", "residential_status", "academic_year", "status"],
    actions: ["promote", "transfer", "graduate", "upload-document", "create-login"],
    bulkActions: ["import-csv", "promote-all", "graduate-final-year"]
  },
  staff: {
    table: "staff",
    label: "Staff",
    icon: "fa-users",
    bucket: STORAGE_BUCKETS.staffPhotos,
    fileField: "photo_url",
    fields: [["full_name", "text", true], ["staff_id", "text", true], ["photo_url", "file"], ["role", "select", true], ["position"], ["rank"], ["gender", "select"], ["phone"], ["email", "email"], ["status", "select"]],
    columns: ["full_name", "staff_id", "role", "position", "rank", "status"],
    actions: ["activate", "deactivate", "assign-subject", "reset-password", "upload-document", "create-login"],
    bulkActions: ["import-csv", "assign-privileges"]
  },
  classes: { table: "classes", label: "Classes", icon: "fa-layer-group", fields: [["name", "text", true], ["level"], ["status", "select"]], columns: ["name", "level", "status"] },
  programmes: { table: "programmes", label: "Programmes", icon: "fa-book-open-reader", fields: [["name", "text", true], ["code"], ["status", "select"]], columns: ["name", "code", "status"] },
  houses: { table: "houses", label: "Houses", icon: "fa-house-user", fields: [["name", "text", true], ["house_master"], ["status", "select"]], columns: ["name", "house_master", "status"] },
  departments: { table: "departments", label: "Departments", icon: "fa-sitemap", fields: [["name", "text", true], ["head_name"], ["status", "select"]], columns: ["name", "head_name", "status"] },
  subjects: { table: "subjects", label: "Subjects", icon: "fa-book", fields: [["name", "text", true], ["code"], ["status", "select"]], columns: ["name", "code", "status"] },
  grading_systems: { table: "grading_systems", label: "Grading", icon: "fa-ranking-star", fields: [["grade", "text", true], ["min_score", "number", true], ["max_score", "number", true], ["remark"], ["status", "select"]], columns: ["grade", "min_score", "max_score", "remark", "status"] },
  assessments: { table: "assessments", label: "Assessments", icon: "fa-clipboard-check", fields: [["title", "text", true], ["term"], ["academic_year"], ["score", "number"], ["status", "select"]], columns: ["title", "term", "academic_year", "score", "status"] },
  results: { table: "results", label: "Results", icon: "fa-square-poll-vertical", fields: [["term"], ["academic_year"], ["score", "number"], ["grade"], ["remarks", "textarea"], ["status", "select"]], columns: ["term", "academic_year", "score", "grade", "remarks", "status"], actions: ["publish", "print-report"], bulkActions: ["publish-all", "generate-report-cards"] },
  transcripts: { table: "transcripts", label: "Transcripts", icon: "fa-file-lines", bucket: STORAGE_BUCKETS.documents, fileField: "transcript_url", fields: [["transcript_url", "file"], ["generated_at", "datetime-local"], ["status", "select"]], columns: ["transcript_url", "generated_at", "status"], actions: ["print-transcript"], bulkActions: ["generate-transcript"] },
  report_cards: { table: "results", label: "Report Cards", icon: "fa-file-invoice", readOnly: true, fields: [], columns: ["term", "academic_year", "score", "grade", "remarks", "status"], actions: ["print-report"] },
  documents: { table: "documents", label: "Documents", icon: "fa-folder-open", bucket: STORAGE_BUCKETS.documents, fileField: "file_url", fields: [["title", "text", true], ["category"], ["assigned_to", "select"], ["file_url", "file"], ["status", "select"]], columns: ["title", "category", "assigned_to", "file_url", "status"], bulkActions: ["bulk-upload"] },
  announcements: { table: "announcements", label: "Announcements", icon: "fa-bullhorn", fields: [["title", "text", true], ["message", "textarea", true], ["audience", "select"], ["scheduled_at", "datetime-local"], ["send_sms", "select"], ["status", "select"]], columns: ["title", "audience", "message", "scheduled_at", "send_sms", "status"], actions: ["publish", "send-sms"], bulkActions: ["schedule-announcement"] },
  sms_settings: { table: "sms_settings", label: "SMS Settings", icon: "fa-sliders", fields: [["sender_id"], ["api_key"], ["api_secret"], ["balance", "number"], ["status", "select"]], columns: ["sender_id", "balance", "status"] },
  sms_logs: { table: "sms_logs", label: "SMS Logs", icon: "fa-comment-sms", fields: [["recipient", "text", true], ["message", "textarea", true], ["sms_type", "select"], ["status", "select"]], columns: ["recipient", "message", "sms_type", "status"], actions: ["send-sms"], bulkActions: ["bulk-sms", "check-sms-balance"] },
  clearance_workflows: { table: "clearance_workflows", label: "Clearance Workflows", icon: "fa-diagram-project", fields: [["name", "text", true], ["description", "textarea"], ["status", "select"]], columns: ["name", "description", "status"] },
  clearance_categories: { table: "clearance_categories", label: "Clearance Categories", icon: "fa-list-check", fields: [["name", "text", true], ["workflow_order", "number"], ["status", "select"]], columns: ["name", "workflow_order", "status"] },
  clearance_officers: { table: "clearance_officers", label: "Clearance Officers", icon: "fa-user-check", fields: [["category_id"], ["staff_id"], ["status", "select"]], columns: ["category_id", "staff_id", "status"] },
  clearance_requests: { table: "clearance_requests", label: "Clearance Requests", icon: "fa-file-signature", fields: [["student_id"], ["academic_year"], ["final_status", "select"], ["status", "select"]], columns: ["student_id", "academic_year", "final_status", "verification_number", "status"], actions: ["approve", "reject", "certificate", "override-approval"], bulkActions: ["apply-clearance", "clearance-report"] },
  clearance_approvals: { table: "clearance_approvals", label: "Clearance Approvals", icon: "fa-check-double", fields: [["request_id"], ["category_id"], ["remarks", "textarea"], ["status", "select"]], columns: ["request_id", "category_id", "officer_id", "remarks", "status"], actions: ["approve", "reject"] },
  assignments: { table: "assignments", label: "Assignments", icon: "fa-upload", bucket: STORAGE_BUCKETS.documents, fileField: "file_url", fields: [["title", "text", true], ["description", "textarea"], ["due_date", "date"], ["file_url", "file"], ["status", "select"]], columns: ["title", "description", "due_date", "file_url", "status"], actions: ["publish"], bulkActions: ["upload-assignment"] },
  attendance: { table: "attendance", label: "Attendance", icon: "fa-calendar-check", fields: [["student_id"], ["attendance_date", "date"], ["attendance_status", "select"], ["remarks", "textarea"], ["status", "select"]], columns: ["student_id", "attendance_date", "attendance_status", "remarks", "status"] },
  scheme_of_work: { table: "scheme_of_work", label: "Scheme of Work", icon: "fa-calendar-days", bucket: STORAGE_BUCKETS.documents, fileField: "file_url", fields: [["term"], ["week"], ["topic", "text", true], ["content", "textarea"], ["file_url", "file"], ["status", "select"]], columns: ["term", "week", "topic", "content", "file_url", "status"] },
  lesson_notes: { table: "lesson_notes", label: "Lesson Notes", icon: "fa-note-sticky", bucket: STORAGE_BUCKETS.documents, fileField: "file_url", fields: [["topic", "text", true], ["lesson_date", "date"], ["notes", "textarea"], ["file_url", "file"], ["status", "select"]], columns: ["topic", "lesson_date", "notes", "file_url", "status"], actions: ["publish"] },
  school_settings: { table: "school_settings", label: "School Settings", icon: "fa-gear", fields: [["helpdesk_phone"], ["helpdesk_email", "email"], ["academic_year"], ["grading_notes", "textarea"], ["dark_mode_default", "select"], ["status", "select"]], columns: ["helpdesk_phone", "helpdesk_email", "academic_year", "status"] },
  system_settings: { table: "system_settings", label: "System Settings", icon: "fa-gears", fields: [["setting_key", "text", true], ["setting_value", "textarea"], ["status", "select"]], columns: ["setting_key", "setting_value", "status"] },
  audit_logs: { table: "audit_logs", label: "Audit Logs", icon: "fa-clipboard-list", readOnly: true, fields: [], columns: ["actor_name", "action", "entity_type", "created_at", "status"] },
  login_history: { table: "login_history", label: "Login History", icon: "fa-clock-rotate-left", readOnly: true, fields: [], columns: ["email", "role", "login_at", "status"] },
  school_statistics: { table: "school_statistics", label: "Statistics", icon: "fa-chart-column", readOnly: true, fields: [], columns: ["metric", "value", "group_name", "status"], bulkActions: ["refresh-statistics"] },
  student_profile: { table: "students", label: "My Profile", icon: "fa-id-card", readOnly: true, fields: [], columns: ["full_name", "student_id", "residential_status", "academic_year", "status"] }
};
