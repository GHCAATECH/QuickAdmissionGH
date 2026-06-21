# QuickAdmissionGH — User Manual

**A web-based Senior High School admission system for Ghana**
Powered by AXIOMBYTE HUB · Version 1.0

---

## 1. Overview

QuickAdmissionGH lets schools run their entire admission process online. It has **three portals**, all contained in one file (`index.html`):

| Portal | Who uses it | What it does |
|--------|-------------|--------------|
| **Student Portal** | Applicants / parents | Pay for a token, fill the personal records form, download admission documents |
| **School Admin** | School staff | Manage placements, students, classes, houses, fees, SMS, templates and documents |
| **Super Admin** | Platform owner (VELOXIS) | Create and oversee all schools |

### Getting around
- Open **`index.html`** in a browser (Chrome/Edge recommended).
- Top-right tabs switch between **Student Portal** and **School Admin**.
- A small **Super Admin** link sits just under the student login card.

---

## 2. Student Portal

### 2.1 Logging in
1. **Select your school** from the dropdown. The school's logo and code appear, confirming your choice.
2. Enter your **BECE index number** (followed by the year, e.g. `100000000026`).
3. Enter your **8-character admission token**.
4. Click **Log in**.

> If a school's admission is **closed**, a notice appears and login/purchase are disabled.

### 2.2 No token yet? Buy one
1. Click **Buy token** (or *Purchase a new admission token*).
2. Select your school and enter your index, name, phone, email.
3. Pay with **Paystack**. Your token is shown and sent by SMS.

### 2.3 Lost your token?
Use **Retrieve token** — search by index number or payment receipt (select your school first).

### 2.4 The Personal Records Form
At first login you accept a short **disclaimer**. After that, complete the form in four parts:

- **A. Placement** — auto-filled from your placement data.
- **B. Enrolment Data** — raw score, enrolment code, JHS attended/type, and **upload your enrolment form** (JPG, max 2 MB).
- **C. Personal Data** — date of birth, nationality, religion, etc. When you pick **"Other"**, a box appears so you can type your own value.
- **D. Parent / Guardian** — contacts and parent details.

Notes:
- **Phone/contact fields accept digits only and a maximum of 10 numbers.**
- In **Class selection**, each class shows its **subject combination** — pick the one you want.

Click **Submit Enrolment** on the Review step to finish.

### 2.5 Downloading documents
From the dashboard you can open/print:
- **Admission Letter**
- **Personal Records Form** (sections A–D, Times New Roman)
- **Prospectus**, **Acceptance/Undertaking**, **Subject Combination** — these open the file the school uploaded, or a default if none.

> Allow pop-ups so documents can open in a new tab.

---

## 3. School Admin Portal

### 3.1 Logging in
Sign in with your school-admin email and password, then accept the disclaimer on first login.
- The **school owner** has full edit access.
- **Sub-users** created by the owner have **read-only** access.

### 3.2 Navigation
The left sidebar groups pages into collapsible **dropdown categories**:
- **Dashboard**
- **Configuration** — School Setup, Student Portal Setup, Financials, SMS, Reports, Templates, Users, Utilities
- **Academic structure** — Programmes, Houses, Classrooms
- **Admissions** — Placement List, and *Admission List* (View Students, Manage Students, Manage House/Class Allocation)

Your name and **Log out** are at the bottom-left.

### 3.3 Placement List
- **Import** a CSV of placed students — click **Download Template CSV** first for the correct columns.
- **Add**, **Edit** or **Delete** individual records.
- **Delete recent import** (undo the last batch) or **Delete all** (submitted students are kept).

### 3.4 Managing students
- **View Students** — browse/print admission lists.
- **Manage Students** — **Edit** any student (name, gender, programme, class, house, contact) or **Delete** a student (works even after they've submitted).
- **House / Class Allocation** — assign or auto-fill students into houses and classes.

### 3.5 Classrooms & subjects
When adding/editing a class, set its **Subject Combination** (comma-separated). It shows in the classrooms table and to students during class selection.

### 3.6 Templates
Design the **Admission Letter** and **Personal Records** printouts. Insert fields like `{STUDENT_NAME}`, `{PROGRAMME}`, `{RECORDS_TABLE}`, `{QR_CODE}`. The records form prints in Times New Roman.

### 3.7 School Setup & Academic Year
- Set school profile, calendar, fees, SMS and student-portal options.
- **Academic year is a dropdown.** Changing it **swaps** datasets: the current year's data is saved aside and the selected year's data is loaded (or starts empty for a new year). **Nothing is deleted** — switch back any time from **Utilities → Saved academic years**.

### 3.8 Admission documents
In **Utilities → Admission documents**, upload **Prospectus**, **Acceptance/Undertaking** and **Subject Combination** files (PDF/Word/image, max 10 MB). Students download exactly these.

### 3.9 Open / close admission
Toggle **Admission OPEN/CLOSED** in the top bar. When closed, students cannot log in, buy tokens, or submit.

### 3.10 Reports
Generate Programme, CSSPS, House, Class and Boarding reports, plus the **QuickAdmissionGH (Excel Import)** export — with a **date filter** to export only students admitted in a chosen range.

---

## 4. Super Admin Portal

Open the small **Super Admin** link under the student login card and sign in.

- **Oversight** — Schools, School Admins, All Students.
- **Configuration** — Financial Reports, SMS Management, System Settings.
- **Creating a school** automatically clones the default (ASUOM) setup: programmes, houses, classes, templates and configuration — with a fresh, empty admission year.

---

## 5. Roles & data scope

- Each admin only sees **their own school's** data.
- The same BECE index can exist at different schools — that's why students **must pick a school** at login.
- Owners can write; sub-users are read-only (the disclaimer's **Agree** button still works for them).

---

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| Document won't open | Allow pop-ups for the site, then click again |
| "Admission is closed" | The school hasn't opened admission yet — contact the school office |
| Can't log in | Make sure you selected the **correct school**, and the index/token match |
| Banner/logo not showing | Keep `banner.png` and `veloxis-logo.png` in the same folder as `index.html` |
| Phone won't accept my number | Fields take **digits only, 10 max** (e.g. `0244000000`) |

---

## 7. Support

For help, contact your school's administration office, or AXIOMBYTE HUB.

Copyright © 2026 AXIOMBYTE HUB. All rights reserved. · Version 1.0
