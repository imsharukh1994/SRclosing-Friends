SR CLOSURE MANAGER - GOOGLE GEMINI EDITION

This version replaces OpenAI with Google's official Google GenAI JavaScript SDK.

AI features:
- Suggest Fast Closures
- Top SRs to work on first
- Closure chance
- Estimated minutes
- Next action
- Closure evidence
- Requester message
- Resolution template
- AI Next Step for an individual SR

SETUP
1. Extract the ZIP.
2. Open CMD in this folder.
3. Run:
   npm install
4. Create .env:
   copy .env.example .env
5. Edit .env and put your NEW Gemini API key:
   GEMINI_API_KEY=YOUR_NEW_GEMINI_API_KEY
6. Start:
   npm start
7. Open:
   http://localhost:3000

SECURITY
- Never put the API key in index.html or app.js.
- Never commit .env.
- The Gemini API key shown in the previous chat/screenshot is exposed. Revoke it and create a new key.
- This app sends the SR information used for AI analysis to Google Gemini when you click an AI button. Confirm your company policy permits sending work SR data to an external AI service.

The project contains the 300 SRs from your uploaded CSV.


CSV IMPORT
- Use the green "📥 Import SR CSV" button at the top-right.
- You can also use "Import New CSV" in the left sidebar.
- The importer expects columns such as:
  Request ID, Created Date, Last Updated Time, Technician.Name,
  Subject, Requester.Name, Status.Name, Priority.Name,
  Site.Name, Category.Name.
- Importing replaces the current imported SR list, so export your tracker first if you have notes you want to keep.


NO DEMO DATA
This build starts with ZERO SRs. There are no sample/fake vendors, requests, dates, amounts, or dashboard records.
Use "📥 Import SR CSV" to load your real SR export.


START EMPTY BEHAVIOR
- This build always starts with zero SRs on a new browser storage key.
- Data from older SR Closure Manager versions will not appear.
- The dashboard is populated only after you click "📥 Import SR CSV" and select a CSV.
- "Reset Imported Data" clears the tracker back to zero.
- If you already have this app open, stop the server and start this version, then refresh http://localhost:3000.


BACKLOG DEADLINE
- Cleanup deadline: 1 January 2027.
- Dashboard shows days remaining.
- Dashboard calculates the minimum average SR closures/day needed based on currently open SRs.
- Gemini prioritization is instructed to help eliminate the backlog before 1 January 2027 while avoiding false closures.


FINAL FIXES
- No demo/sample SR data.
- Starts empty until CSV import.
- Clears legacy browser storage keys from older versions.
- Fixed the CSV importer: parseCSV is now defined and supports quoted CSV fields and comma/semicolon delimiters.
- Supports Request ID, Created Date, Last Updated Time, Technician, Subject, Requester, Status, Priority, Site and Category column variants.
- Importing a CSV replaces the displayed SR list while preserving tracker notes for matching SR IDs.


UI FIX: The deadline banner is now correctly placed in the main dashboard, not inside the sidebar navigation. CSS/JS cache-busting was added.


CSV IMPORT FIX
- Fixed the JavaScript syntax error that prevented the entire app.js file from loading.
- Fixed CSV import so selecting a file actually parses and loads it.
- Supports comma or semicolon CSV delimiters.
- Supports quoted fields and escaped quotes.
- Detects common Request ID header variants.
- Starts with zero SRs using a new clean browser storage key.


GEMINI AVAILABILITY FIX
- Gemini 3.6 Flash remains the primary model.
- The server automatically retries transient 503/429 errors.
- If Gemini 3.6 Flash is temporarily overloaded, it automatically falls back to Gemini 3.5 Flash-Lite.
- No API key changes are required.
- The fallback is intended to keep "Suggest Fast Closures" working during temporary model-capacity spikes.


FINAL UI / AI FIXES
- Removed the malformed "This is a single-line comment" text from the import area.
- Fixed the Import SR CSV control so only the styled button is visible.
- Fixed malformed deadline CSS.
- Deadline is displayed in the main dashboard, not the sidebar.
- Dashboard starts empty in a new browser storage key.
- AI Closure Copilot no longer displays heuristic/demo recommendations automatically.
- Gemini recommendations appear only after clicking "Suggest Fast Closures".
- Only the top 60 locally-prioritized open SRs are sent to Gemini to keep requests smaller and more reliable.
- Gemini 3.6 Flash is primary; Gemini 2.5 Flash-Lite is fallback for temporary capacity/rate-limit errors.
