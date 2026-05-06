# UC-ANALYTICS — Analytics & Reporting

---

## Viewing Analytics

### UC-AV01: View Overview KPIs
**Actor:** Museum Admin  
**Precondition:** Museum has collected engagement data.  
**Main Flow:**
1. Admin selects a date range and opens analytics overview.
2. System returns near real-time KPIs (visitors, scans, completions, AI queries).
3. Trend charts visualize daily engagement.
**Exceptions:**
- No data for selected range → empty charts displayed.

---

### UC-AV02: View User Segmentation
**Actor:** Museum Admin  
**Precondition:** Users exist with behavioral data.  
**Main Flow:**
1. Admin opens the user segmentation view.
2. System displays users categorized into segments (Explorer, Scholar, Passive, Newcomer).
3. Admin uses segments as filters on user lists and dashboards.
**Exceptions:**
- None.

---

### UC-AV03: View AI Performance Metrics
**Actor:** Museum Admin  
**Precondition:** AI chat sessions have occurred.  
**Main Flow:**
1. Admin opens AI performance analytics.
2. System displays session continuation rate, suggested question tap rate, feedback, and token costs.
**Exceptions:**
- AI disabled for museum → no data available.

---

### UC-AV04: Unauthorized Analytics Access
**Actor:** Content Editor / Visitor  
**Precondition:** Actor does not have museum_admin role.  
**Main Flow:**
1. Actor attempts to access analytics endpoints.
2. System checks role permissions.
3. Full analytics access is denied (content editor sees read-only subset; visitor sees nothing).
**Exceptions:**
- None.

---

## Export

### UC-AE01: Request Data Export
**Actor:** Museum Admin  
**Precondition:** Analytics data exists for the museum.  
**Main Flow:**
1. Admin requests an export (CSV or PDF) for a specific report type.
2. System queues the export job and returns a job reference.
3. Admin is notified when the export is ready for download.
**Exceptions:**
- None.

---

### UC-AE02: Download Completed Export
**Actor:** Museum Admin  
**Precondition:** Export job has completed.  
**Main Flow:**
1. Admin checks the export job status.
2. System returns a time-limited download link.
3. Admin downloads the file.
**Exceptions:**
- Download link expired → admin must re-request the export.

---

### UC-AE03: PII-Free Export Validation
**Actor:** System  
**Precondition:** Export job is generating a file.  
**Main Flow:**
1. System processes the export data.
2. All user references are replaced with anonymized labels (e.g., "Visitor #4821").
3. No direct PII (names, emails) is included in the output file.
**Exceptions:**
- None.

---

## Edge Cases

### UC-AX01: Export Job Failure
**Actor:** Museum Admin  
**Precondition:** Export job has been queued.  
**Main Flow:**
1. Bull queue job begins processing the export.
2. Job fails (e.g., out of memory on large dataset, S3 write error, database timeout).
3. Job is retried (max 3 retries with exponential backoff).
4. If all retries fail, job status is set to `failed`.
5. Admin checks the export status and sees an error message.
6. Admin must re-request the export.
**Exceptions:**
- None.

---

### UC-AX02: Export Download Link Expired
**Actor:** Museum Admin  
**Precondition:** Export completed but admin did not download within the link TTL.  
**Main Flow:**
1. Admin checks the export job status — job is complete.
2. Admin clicks the download link.
3. S3 pre-signed URL has expired (recommended TTL: 1 hour).
4. Download fails with an expired link error.
5. Admin must re-request the export to generate a new download link.
**Exceptions:**
- None.

---

### UC-AX03: Query Beyond Data Retention Window
**Actor:** Museum Admin  
**Precondition:** Admin selects a date range extending beyond the 12-month retention period.  
**Main Flow:**
1. Admin requests analytics for a range older than 12 months.
2. System queries the TimescaleDB hypertable but finds no data for the expired partitions.
3. Partial results are returned (only data within retention window).
4. Admin is informed that data older than 12 months has been purged per retention policy.
**Exceptions:**
- None.

---

### UC-AX04: Near Real-Time vs. Batch Data Discrepancy
**Actor:** Museum Admin  
**Precondition:** Admin views the dashboard during an active engagement period.  
**Main Flow:**
1. Admin sees KPI cards showing near real-time numbers (~60s lag).
2. Admin opens trend charts or heatmap (hourly batch-processed).
3. Numbers may not match perfectly due to the different update cadences.
4. System displays a timestamp on each widget indicating "Last updated: {time}".
**Exceptions:**
- None.

---

### UC-AX05: Super Admin Views System-Wide Analytics
**Actor:** Super Admin  
**Precondition:** Super admin is authenticated; platform has multiple museums.  
**Main Flow:**
1. Super admin opens the system-wide analytics overview.
2. System aggregates KPIs across all museums (total users, scans, AI costs, per-museum breakdown).
3. Super admin can drill down into individual museum analytics.
**Exceptions:**
- No museums on the platform → empty dashboard.

---

### UC-AX06: Artifact Heatmap Calculation
**Actor:** Museum Admin  
**Precondition:** Museum has artifacts with engagement data.  
**Main Flow:**
1. Admin opens the artifact heatmap view.
2. System calculates the Weighted Composite Score (0–100) per artifact: 40% QR Scans, 30% AI Queries, 20% Page Views, 10% Dwell Time.
3. Scores are normalized across all museum artifacts.
4. Artifacts are displayed ranked/colored by their composite score.
**Exceptions:**
- New artifact with no engagement data → score is 0, displayed at the bottom.
