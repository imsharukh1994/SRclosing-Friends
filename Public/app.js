/* =========================================================
   SR CLOSURE MANAGER
   Complete app.js
   CSV -> In-Memory State -> Dashboard -> Gemini AI
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const API_BASE = "";

  const STORAGE_KEY = "sr_closure_manager_v6_final";

  const DEADLINE = "2027-01-01";

  const DEFAULT_TARGET = 10;


  /* =========================================================
     APPLICATION STATE
     ========================================================= */

  const state = {
    requests: [],
    updates: [],
    aiSuggestions: [],
    currentSR: null,
    importedFileName: "",
    target: DEFAULT_TARGET
  };


  /* =========================================================
     HELPERS
     ========================================================= */

  function $(id) {
    return document.getElementById(id);
  }


  function escapeHTML(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function todayISO() {

    return new Date()
      .toISOString()
      .slice(0, 10);

  }


  function daysBetween(date1, date2) {

    const a =
      new Date(date1);

    const b =
      new Date(date2);

    if (
      Number.isNaN(a.getTime()) ||
      Number.isNaN(b.getTime())
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(
        (b - a) /
        86400000
      )
    );

  }


  function normalize(value) {

    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  }


  function safeNumber(value, fallback = 0) {

    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;

  }


  /* =========================================================
     DATE / AGE
     ========================================================= */

  function calculateAgeDays(created) {

    if (!created) {
      return 0;
    }

    const date =
      new Date(created);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          date.getTime()
        ) /
        86400000
      )
    );

  }


  function calculateStaleDays(updated) {

    if (!updated) {
      return 999;
    }

    const date =
      new Date(updated);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 999;
    }

    return Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          date.getTime()
        ) /
        86400000
      )
    );

  }


  /* =========================================================
     CSV PARSER
     ========================================================= */

  function parseCSV(text) {

    const rows = [];

    let row = [];

    let value = "";

    let quoted = false;


    text =
      String(text || "")
        .replace(/^\uFEFF/, "");


    for (
      let i = 0;
      i < text.length;
      i++
    ) {

      const ch =
        text[i];


      if (ch === '"') {

        if (
          quoted &&
          text[i + 1] === '"'
        ) {

          value += '"';

          i++;

        } else {

          quoted =
            !quoted;

        }

        continue;

      }


      if (
        !quoted &&
        (
          ch === "," ||
          ch === ";"
        )
      ) {

        row.push(
          value.trim()
        );

        value = "";

        continue;

      }


      if (
        !quoted &&
        (
          ch === "\n" ||
          ch === "\r"
        )
      ) {

        if (
          ch === "\r" &&
          text[i + 1] === "\n"
        ) {

          i++;

        }


        row.push(
          value.trim()
        );

        value = "";


        if (
          row.some(
            cell =>
              String(cell)
                .trim() !== ""
          )
        ) {

          rows.push(row);

        }


        row = [];

        continue;

      }


      value += ch;

    }


    if (
      value !== "" ||
      row.length
    ) {

      row.push(
        value.trim()
      );


      if (
        row.some(
          cell =>
            String(cell)
              .trim() !== ""
        )
      ) {

        rows.push(row);

      }

    }


    return rows;

  }


  /* =========================================================
     FIND CSV COLUMN
     ========================================================= */

  function findColumn(headers, candidates) {

    const normalizedHeaders =
      headers.map(normalize);


    for (
      const candidate of candidates
    ) {

      const index =
        normalizedHeaders.indexOf(
          normalize(candidate)
        );


      if (index !== -1) {
        return index;
      }

    }


    return -1;

  }


  /* =========================================================
     CSV IMPORT
     ========================================================= */

  async function importSRFile(file) {

    if (!file) {
      return;
    }


    console.log(
      "📥 CSV selected:",
      file.name
    );


    try {

      const text =
        await file.text();


      if (!text.trim()) {

        throw new Error(
          "The CSV file is empty."
        );

      }


      const rows =
        parseCSV(text);


      if (
        rows.length < 2
      ) {

        throw new Error(
          "The CSV must contain a header row and at least one SR."
        );

      }


      const headers =
        rows[0].map(
          value =>
            String(value || "")
              .trim()
        );


      console.log(
        "📋 CSV columns:",
        headers
      );


      console.log(
        "📊 CSV rows:",
        rows.length - 1
      );


      const idIndex =
        findColumn(
          headers,
          [
            "Request ID",
            "RequestID",
            "Request Id",
            "SR ID",
            "SRID",
            "Service Request ID",
            "ServiceRequestID",
            "Ticket ID",
            "TicketID",
            "ID",
            "Number"
          ]
        );


      if (
        idIndex === -1
      ) {

        throw new Error(
          "No SR ID column was found.\n\n" +
          "Detected columns:\n" +
          headers.join(", ") +
          "\n\n" +
          "Please ensure your CSV has a column such as Request ID, SR ID, Service Request ID or Ticket ID."
        );

      }


      const columns = {

        subject:
          findColumn(
            headers,
            [
              "Subject",
              "Short Description",
              "Description",
              "Title"
            ]
          ),

        requester:
          findColumn(
            headers,
            [
              "Requester",
              "Requested By",
              "Requestor",
              "User"
            ]
          ),

        technician:
          findColumn(
            headers,
            [
              "Technician",
              "Assigned To",
              "Assignee",
              "Owner"
            ]
          ),

        status:
          findColumn(
            headers,
            [
              "Status",
              "State"
            ]
          ),

        priority:
          findColumn(
            headers,
            [
              "Priority",
              "Urgency"
            ]
          ),

        site:
          findColumn(
            headers,
            [
              "Site",
              "Location",
              "Plant",
              "Branch"
            ]
          ),

        category:
          findColumn(
            headers,
            [
              "Category",
              "Type",
              "Request Type"
            ]
          ),

        created:
          findColumn(
            headers,
            [
              "Created",
              "Created Date",
              "Created On",
              "Opened",
              "Open Date"
            ]
          ),

        updated:
          findColumn(
            headers,
            [
              "Updated",
              "Updated Date",
              "Last Updated",
              "Modified",
              "Modified Date"
            ]
          ),

        resolution:
          findColumn(
            headers,
            [
              "Resolution",
              "Resolution Note",
              "Resolution Notes"
            ]
          ),

        notes:
          findColumn(
            headers,
            [
              "Notes",
              "Comments",
              "Work Notes",
              "Description"
            ]
          )

      };


      const imported = [];


      for (
        let i = 1;
        i < rows.length;
        i++
      ) {

        const row =
          rows[i];


        const id =
          String(
            row[idIndex] || ""
          ).trim();


        if (!id) {
          continue;
        }


        const getValue =
          index =>
            index >= 0
              ? String(
                  row[index] || ""
                ).trim()
              : "";


        const created =
          getValue(
            columns.created
          );


        const updated =
          getValue(
            columns.updated
          );


        const status =
          getValue(
            columns.status
          ) ||
          "Open";


        const ageDays =
          calculateAgeDays(
            created
          );


        const staleDays =
          calculateStaleDays(
            updated
          );


        let stage =
          "New";


        const statusLower =
          status.toLowerCase();


        if (
          statusLower.includes(
            "closed"
          ) ||
          statusLower.includes(
            "resolved"
          )
        ) {

          stage =
            "Closed in Tracker";

        } else if (
          statusLower.includes(
            "waiting"
          )
        ) {

          stage =
            "Waiting Requester";

        } else if (
          statusLower.includes(
            "blocked"
          )
        ) {

          stage =
            "Blocked";

        } else {

          stage =
            "Working";

        }


        imported.push({

          id,

          subject:
            getValue(
              columns.subject
            ),

          requester:
            getValue(
              columns.requester
            ),

          technician:
            getValue(
              columns.technician
            ),

          status,

          priority:
            getValue(
              columns.priority
            ),

          site:
            getValue(
              columns.site
            ),

          category:
            getValue(
              columns.category
            ),

          created,

          updated,

          ageDays,

          staleDays,

          myStage:
            stage,

          nextAction:
            "",

          resolution:
            getValue(
              columns.resolution
            ),

          notes:
            getValue(
              columns.notes
            ),

          followupDate:
            "",

          closeReady:
            false,

          importedAt:
            new Date().toISOString()

        });

      }


      if (
        !imported.length
      ) {

        throw new Error(
          "No SR records could be created from the CSV."
        );

      }


      /*
       * CSV is now the source of truth.
       * No Local Storage required.
       */

      state.requests =
        imported;

      state.updates =
        [];

      state.aiSuggestions =
        [];

      state.importedFileName =
        file.name;


      console.log(
        "✅ Imported SRs:",
        imported.length
      );


      render();


      alert(
        `Successfully imported ${imported.length} SRs from ${file.name}`
      );


    } catch (error) {

      console.error(
        "❌ CSV import failed:",
        error
      );


      alert(
        "CSV import failed:\n\n" +
        (
          error.message ||
          "Unknown error"
        )
      );

    }

  }


  /* =========================================================
     CSV INPUT HANDLERS
     ========================================================= */

  function handleCSVInput(event) {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    importSRFile(file);


    setTimeout(() => {

      event.target.value =
        "";

    }, 300);

  }


  function setupCSVInputs() {

    const csvInput =
      $("csvInput");


    const topCsvInput =
      $("topCsvInput");


    if (csvInput) {

      csvInput.addEventListener(
        "change",
        handleCSVInput
      );

    }


    if (topCsvInput) {

      topCsvInput.addEventListener(
        "change",
        handleCSVInput
      );

    }

  }


  /* =========================================================
     STATS
     ========================================================= */

  function getOpenRequests() {

    return state.requests.filter(
      sr =>
        sr.myStage !==
        "Closed in Tracker" &&
        !String(
          sr.status || ""
        )
          .toLowerCase()
          .includes("closed")
    );

  }


  function getStats() {

    const open =
      getOpenRequests();


    const old60 =
      open.filter(
        sr =>
          safeNumber(
            sr.ageDays
          ) >= 60
      );


    const old30 =
      open.filter(
        sr =>
          safeNumber(
            sr.ageDays
          ) >= 30
      );


    const stale =
      open.filter(
        sr =>
          safeNumber(
            sr.staleDays
          ) >= 7
      );


    const ready =
      open.filter(
        sr =>
          sr.myStage ===
          "Ready to Close" ||
          sr.closeReady === true
      );


    return {

      open:
        open.length,

      old60:
        old60.length,

      old30:
        old30.length,

      stale:
        stale.length,

      ready:
        ready.length

    };

  }


  /* =========================================================
     DEADLINE
     ========================================================= */

  function renderDeadline() {

    const today =
      new Date();


    const deadline =
      new Date(
        DEADLINE
      );


    const days =
      Math.max(
        0,
        Math.ceil(
          (
            deadline -
            today
          ) /
          86400000
        )
      );


    const open =
      getOpenRequests().length;


    const required =
      days > 0
        ? Math.ceil(
            open / days
          )
        : open;


    if ($("daysRemaining")) {

      $("daysRemaining")
        .textContent =
        days;

    }


    if ($("daysRemainingSide")) {

      $("daysRemainingSide")
        .textContent =
        days;

    }


    if ($("dailyRequired")) {

      $("dailyRequired")
        .textContent =
        required;

    }


    if ($("dailyRequiredSide")) {

      $("dailyRequiredSide")
        .textContent =
        required;

    }

  }


  /* =========================================================
     DASHBOARD
     ========================================================= */

  function renderDashboard() {

    const stats =
      getStats();


    if ($("openCount")) {

      $("openCount")
        .textContent =
        stats.open;

    }


    if ($("old60")) {

      $("old60")
        .textContent =
        stats.old60;

    }


    if ($("old30")) {

      $("old30")
        .textContent =
        stats.old30;

    }


    if ($("stale")) {

      $("stale")
        .textContent =
        stats.stale;

    }


    if ($("ready")) {

      $("ready")
        .textContent =
        stats.ready;

    }


    if ($("rOpen")) {

      $("rOpen")
        .textContent =
        stats.open;

    }


    const closed =
      state.requests.filter(
        sr =>
          sr.myStage ===
          "Closed in Tracker"
      ).length;


    if ($("rClosed")) {

      $("rClosed")
        .textContent =
        closed;

    }


    const requester =
      state.requests.filter(
        sr =>
          sr.myStage ===
          "Waiting Requester"
      ).length;


    if ($("rRequester")) {

      $("rRequester")
        .textContent =
        requester;

    }


    const vendor =
      state.requests.filter(
        sr =>
          sr.myStage ===
          "Waiting Vendor"
      ).length;


    if ($("rVendor")) {

      $("rVendor")
        .textContent =
        vendor;

    }


    renderMission();

    renderQuickWins();

    renderOldest();

    renderRecommendations();

  }


  /* =========================================================
     MISSION
     ========================================================= */

  function renderMission() {

    const closedToday =
      state.updates.filter(
        update =>
          update.date ===
          todayISO() &&
          update.type ===
          "closed"
      ).length;


    const target =
      safeNumber(
        $("targetInput")?.value,
        DEFAULT_TARGET
      );


    if ($("closedToday")) {

      $("closedToday")
        .textContent =
        closedToday;

    }


    const percent =
      target > 0
        ? Math.min(
            100,
            Math.round(
              (
                closedToday /
                target
              ) * 100
            )
          )
        : 0;


    if ($("missionBar")) {

      $("missionBar")
        .style.width =
        percent + "%";

    }


    if ($("missionText")) {

      $("missionText")
        .textContent =
        `Target: ${target}`;

    }

  }


  /* =========================================================
     QUICK WINS
     ========================================================= */

  function scoreSR(sr) {

    let score =
      0;


    if (
      sr.myStage ===
      "Ready to Close"
    ) {

      score += 50;

    }


    if (
      sr.closeReady
    ) {

      score += 40;

    }


    if (
      safeNumber(
        sr.ageDays
      ) >= 30
    ) {

      score += 10;

    }


    if (
      safeNumber(
        sr.staleDays
      ) >= 7
    ) {

      score += 5;

    }


    const text =
      (
        sr.subject +
        " " +
        sr.notes +
        " " +
        sr.resolution
      )
        .toLowerCase();


    const quickWords = [
      "confirmation",
      "password",
      "access",
      "printer",
      "install",
      "setup",
      "configuration",
      "resolved",
      "working"
    ];


    for (
      const word of quickWords
    ) {

      if (
        text.includes(word)
      ) {

        score += 4;

      }

    }


    if (
      sr.myStage ===
      "Blocked" ||
      sr.myStage ===
      "Waiting Vendor"
    ) {

      score -= 30;

    }


    return score;

  }


  function renderQuickWins() {

    const container =
      $("quickWins");


    if (!container) {
      return;
    }


    const list =
      getOpenRequests()
        .slice()
        .sort(
          (a, b) =>
            scoreSR(b) -
            scoreSR(a)
        )
        .slice(0, 6);


    if (!list.length) {

      container.innerHTML =
        `<div class="empty">
          No SRs available.
        </div>`;

      return;

    }


    container.innerHTML =
      list.map(
        sr => `

          <div class="action-row">

            <div>

              <strong class="sr-id">
                ${escapeHTML(sr.id)}
              </strong>

              <div>
                ${escapeHTML(
                  sr.subject ||
                  "No subject"
                )}
              </div>

              <div class="action-meta">
                ${escapeHTML(
                  sr.myStage
                )}
                ·
                ${safeNumber(
                  sr.ageDays
                )} days old
              </div>

            </div>


            <div class="action-btn">

              <span class="tag green">
                Quick
              </span>

              <button
                class="ghost"
                data-action="work"
                data-id="${escapeHTML(sr.id)}"
              >
                Work
              </button>

            </div>

          </div>

        `
      )
      .join("");

  }


  /* =========================================================
     OLDEST SRs
     ========================================================= */

  function renderOldest() {

    const container =
      $("oldestTable");


    if (!container) {
      return;
    }


    const list =
      getOpenRequests()
        .slice()
        .sort(
          (a, b) =>
            safeNumber(
              b.ageDays
            ) -
            safeNumber(
              a.ageDays
            )
        )
        .slice(0, 10);


    if (!list.length) {

      container.innerHTML =
        `<div class="empty">
          No open SRs.
        </div>`;

      return;

    }


    container.innerHTML = `

      <div class="table-wrap">

        <table>

          <thead>

            <tr>
              <th>SR</th>
              <th>Subject</th>
              <th>Age</th>
              <th>Stage</th>
              <th>Action</th>
            </tr>

          </thead>

          <tbody>

            ${list.map(
              sr => `

                <tr>

                  <td class="sr-id">
                    ${escapeHTML(sr.id)}
                  </td>

                  <td>
                    ${escapeHTML(
                      sr.subject ||
                      "-"
                    )}
                  </td>

                  <td class="${
                    sr.ageDays >= 60
                      ? "age-old"
                      : sr.ageDays >= 30
                      ? "age-mid"
                      : ""
                  }">

                    ${safeNumber(
                      sr.ageDays
                    )} days

                  </td>

                  <td>
                    <span class="stage">
                      ${escapeHTML(
                        sr.myStage
                      )}
                    </span>
                  </td>

                  <td>

                    <button
                      class="ghost"
                      data-action="work"
                      data-id="${escapeHTML(sr.id)}"
                    >
                      Work
                    </button>

                  </td>

                </tr>

              `
            ).join("")}

          </tbody>

        </table>

      </div>

    `;

  }


  /* =========================================================
     RECOMMENDATIONS
     ========================================================= */

  function renderRecommendations() {

    const container =
      $("recommendations");


    if (!container) {
      return;
    }


    const list =
      getOpenRequests()
        .slice()
        .sort(
          (a, b) =>
            scoreSR(b) -
            scoreSR(a)
        )
        .slice(0, 8);


    if (!list.length) {

      container.innerHTML =
        `<div class="empty">
          Import your SR CSV to see recommendations.
        </div>`;

      return;

    }


    container.innerHTML =
      list.map(
        (sr, index) => `

          <div class="action-row">

            <div>

              <strong>
                ${index + 1}.
                ${escapeHTML(
                  sr.id
                )}
              </strong>

              <div>
                ${escapeHTML(
                  sr.subject ||
                  "No subject"
                )}
              </div>

              <div class="action-meta">
                ${escapeHTML(
                  sr.myStage
                )}
                ·
                ${safeNumber(
                  sr.ageDays
                )} days
              </div>

            </div>


            <button
              class="ghost"
              data-action="work"
              data-id="${escapeHTML(
                sr.id
              )}"
            >
              Open
            </button>

          </div>

        `
      )
      .join("");

  }


  /* =========================================================
     QUEUE
     ========================================================= */

  function renderQueue() {

    const container =
      $("queueTable");


    if (!container) {
      return;
    }


    const filter =
      $("queueFilter")
        ?.value ||
      "all";


    const stage =
      $("stageFilter")
        ?.value ||
      "";


    const search =
      (
        $("queueSearch")
          ?.value ||
        ""
      )
        .toLowerCase()
        .trim();


    let list =
      getOpenRequests();


    if (
      filter ===
      "quick"
    ) {

      list =
        list.filter(
          sr =>
            scoreSR(sr) >= 25
        );

    }


    if (
      filter ===
      "old"
    ) {

      list =
        list.filter(
          sr =>
            safeNumber(
              sr.ageDays
            ) >= 30
        );

    }


    if (
      filter ===
      "stale"
    ) {

      list =
        list.filter(
          sr =>
            safeNumber(
              sr.staleDays
            ) >= 7
        );

    }


    if (
      filter ===
      "ready"
    ) {

      list =
        list.filter(
          sr =>
            sr.myStage ===
              "Ready to Close" ||
            sr.closeReady
        );

    }


    if (
      filter ===
      "blocked"
    ) {

      list =
        list.filter(
          sr =>
            sr.myStage ===
              "Blocked" ||
            sr.myStage ===
              "Waiting Vendor" ||
            sr.myStage ===
              "Waiting Requester"
        );

    }


    if (stage) {

      list =
        list.filter(
          sr =>
            sr.myStage ===
            stage
        );

    }


    if (search) {

      list =
        list.filter(
          sr =>
            JSON.stringify(
              sr
            )
              .toLowerCase()
              .includes(search)
        );

    }


    list.sort(
      (a, b) =>
        scoreSR(b) -
        scoreSR(a)
    );


    if (!list.length) {

      container.innerHTML =
        `<div class="empty">
          No matching SRs.
        </div>`;

      return;

    }


    container.innerHTML = `

      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>SR</th>
              <th>Subject</th>
              <th>Priority</th>
              <th>Age</th>
              <th>Stage</th>
              <th>Score</th>
              <th>Action</th>

            </tr>

          </thead>

          <tbody>

            ${list.map(
              sr => `

                <tr>

                  <td class="sr-id">
                    ${escapeHTML(
                      sr.id
                    )}
                  </td>

                  <td>
                    ${escapeHTML(
                      sr.subject ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${escapeHTML(
                      sr.priority ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${safeNumber(
                      sr.ageDays
                    )} days
                  </td>

                  <td>
                    <span class="stage">
                      ${escapeHTML(
                        sr.myStage
                      )}
                    </span>
                  </td>

                  <td class="score">
                    ${scoreSR(sr)}
                  </td>

                  <td>

                    <button
                      class="ghost"
                      data-action="work"
                      data-id="${escapeHTML(
                        sr.id
                      )}"
                    >
                      Work
                    </button>

                  </td>

                </tr>

              `
            ).join("")}

          </tbody>

        </table>

      </div>

    `;

  }


  /* =========================================================
     ALL REQUESTS
     ========================================================= */

  function renderAll() {

    const container =
      $("allTable");


    if (!container) {
      return;
    }


    const search =
      (
        $("allSearch")
          ?.value ||
        ""
      )
        .toLowerCase()
        .trim();


    const category =
      $("catFilter")
        ?.value ||
      "";


    const site =
      $("siteFilter")
        ?.value ||
      "";


    const priority =
      $("priorityFilter")
        ?.value ||
      "";


    let list =
      state.requests.slice();


    if (search) {

      list =
        list.filter(
          sr =>
            JSON.stringify(
              sr
            )
              .toLowerCase()
              .includes(search)
        );

    }


    if (category) {

      list =
        list.filter(
          sr =>
            sr.category ===
            category
        );

    }


    if (site) {

      list =
        list.filter(
          sr =>
            sr.site ===
            site
        );

    }


    if (priority) {

      list =
        list.filter(
          sr =>
            sr.priority ===
            priority
        );

    }


    if (!list.length) {

      container.innerHTML =
        `<div class="empty">
          No requests found.
        </div>`;

      return;

    }


    container.innerHTML = `

      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>SR</th>
              <th>Subject</th>
              <th>Requester</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Site</th>
              <th>Age</th>
              <th>Action</th>

            </tr>

          </thead>

          <tbody>

            ${list.map(
              sr => `

                <tr>

                  <td class="sr-id">
                    ${escapeHTML(
                      sr.id
                    )}
                  </td>

                  <td>
                    ${escapeHTML(
                      sr.subject ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${escapeHTML(
                      sr.requester ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${escapeHTML(
                      sr.status ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${escapeHTML(
                      sr.priority ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${escapeHTML(
                      sr.site ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${safeNumber(
                      sr.ageDays
                    )} days
                  </td>

                  <td>

                    <button
                      class="ghost"
                      data-action="work"
                      data-id="${escapeHTML(
                        sr.id
                      )}"
                    >
                      Work
                    </button>

                  </td>

                </tr>

              `
            ).join("")}

          </tbody>

        </table>

      </div>

    `;

  }


  /* =========================================================
     FILTER OPTIONS
     ========================================================= */

  function updateFilters() {

    const categories =
      [
        ...new Set(
          state.requests
            .map(
              sr =>
                sr.category
            )
            .filter(Boolean)
        )
      ]
        .sort();


    const sites =
      [
        ...new Set(
          state.requests
            .map(
              sr =>
                sr.site
            )
            .filter(Boolean)
        )
      ]
        .sort();


    const priorities =
      [
        ...new Set(
          state.requests
            .map(
              sr =>
                sr.priority
            )
            .filter(Boolean)
        )
      ]
        .sort();


    fillSelect(
      $("catFilter"),
      categories,
      "All categories"
    );


    fillSelect(
      $("siteFilter"),
      sites,
      "All sites"
    );


    fillSelect(
      $("priorityFilter"),
      priorities,
      "All priorities"
    );

  }


  function fillSelect(
    select,
    values,
    firstText
  ) {

    if (!select) {
      return;
    }


    const current =
      select.value;


    select.innerHTML =
      `<option value="">
        ${firstText}
      </option>` +
      values.map(
        value =>
          `<option value="${escapeHTML(value)}">
            ${escapeHTML(value)}
          </option>`
      ).join("");


    if (
      values.includes(
        current
      )
    ) {

      select.value =
        current;

    }

  }


  /* =========================================================
     REPORTS
     ========================================================= */

  function renderReports() {

    const container =
      $("categoryReport");


    if (!container) {
      return;
    }


    const counts = {};


    state.requests.forEach(
      sr => {

        const category =
          sr.category ||
          "Uncategorized";


        counts[category] =
          (
            counts[category] ||
            0
          ) + 1;

      }
    );


    const entries =
      Object.entries(
        counts
      )
        .sort(
          (a, b) =>
            b[1] -
            a[1]
        );


    if (!entries.length) {

      container.innerHTML =
        `<div class="empty">
          No category data.
        </div>`;

      return;

    }


    const max =
      Math.max(
        ...entries.map(
          entry =>
            entry[1]
        )
      );


    container.innerHTML =
      entries.map(
        ([category, count]) => `

          <div class="barrow">

            <div class="barlabel">

              <span>
                ${escapeHTML(
                  category
                )}
              </span>

              <strong>
                ${count}
              </strong>

            </div>


            <div class="bar">

              <span
                style="width:${
                  Math.round(
                    (
                      count /
                      max
                    ) *
                    100
                  )
                }%"
              ></span>

            </div>

          </div>

        `
      ).join("");

  }


  /* =========================================================
     UPDATES
     ========================================================= */

  function renderUpdates() {

    const container =
      $("updatesTable");


    if (!container) {
      return;
    }


    if (!state.updates.length) {

      container.innerHTML =
        `<div class="empty">
          No work updates yet.
        </div>`;

      return;

    }


    container.innerHTML = `

      <div class="table-wrap">

        <table>

          <thead>

            <tr>
              <th>Date</th>
              <th>SR</th>
              <th>Action</th>
              <th>Stage</th>
              <th>Notes</th>
            </tr>

          </thead>

          <tbody>

            ${state.updates
              .slice()
              .reverse()
              .map(
                update => `

                  <tr>

                    <td>
                      ${escapeHTML(
                        update.date
                      )}
                    </td>

                    <td class="sr-id">
                      ${escapeHTML(
                        update.id
                      )}
                    </td>

                    <td>
                      ${escapeHTML(
                        update.action ||
                        "-"
                      )}
                    </td>

                    <td>
                      ${escapeHTML(
                        update.stage ||
                        "-"
                      )}
                    </td>

                    <td>
                      ${escapeHTML(
                        update.notes ||
                        "-"
                      )}
                    </td>

                  </tr>

                `
              )
              .join("")}

          </tbody>

        </table>

      </div>

    `;

  }


  /* =========================================================
     WORK MODAL
     ========================================================= */

  function openWorkSR(id) {

    const sr =
      state.requests.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );


    if (!sr) {

      alert(
        "SR not found."
      );

      return;

    }


    state.currentSR =
      sr;


    if ($("srId")) {

      $("srId")
        .value =
        sr.id;

    }


    if ($("modalTitle")) {

      $("modalTitle")
        .textContent =
        `Work ${sr.id}`;

    }


    if ($("modalSubtitle")) {

      $("modalSubtitle")
        .textContent =
        sr.subject ||
        "";

    }


    if ($("srInfo")) {

      $("srInfo").innerHTML = `

        <strong>
          ${escapeHTML(
            sr.id
          )}
        </strong>

        <br>

        ${escapeHTML(
          sr.subject ||
          "No subject"
        )}

        <br><br>

        Requester:
        ${escapeHTML(
          sr.requester ||
          "-"
        )}

        <br>

        Site:
        ${escapeHTML(
          sr.site ||
          "-"
        )}

        <br>

        Priority:
        ${escapeHTML(
          sr.priority ||
          "-"
        )}

        <br>

        Age:
        ${safeNumber(
          sr.ageDays
        )} days

      `;

    }


    if ($("myStage")) {

      $("myStage")
        .value =
        sr.myStage ||
        "New";

    }


    if ($("followupDate")) {

      $("followupDate")
        .value =
        sr.followupDate ||
        "";

    }


    if ($("nextAction")) {

      $("nextAction")
        .value =
        sr.nextAction ||
        "";

    }


    if ($("resolution")) {

      $("resolution")
        .value =
        sr.resolution ||
        "";

    }


    if ($("notes")) {

      $("notes")
        .value =
        sr.notes ||
        "";

    }


    if ($("closeReady")) {

      $("closeReady")
        .checked =
        Boolean(
          sr.closeReady
        );

    }


    if ($("aiWorkSuggestion")) {

      $("aiWorkSuggestion")
        .textContent =
        "Click AI Suggest Next Step to generate guidance.";

    }


    $("srModal")
      ?.classList.remove(
        "hidden"
      );

  }


  function closeModal() {

    $("srModal")
      ?.classList.add(
        "hidden"
      );

    state.currentSR =
      null;

  }


  /* =========================================================
     SAVE SR UPDATE
     ========================================================= */

  function saveSRUpdate() {

    if (!state.currentSR) {
      return;
    }


    const sr =
      state.currentSR;


    sr.myStage =
      $("myStage")
        ?.value ||
      sr.myStage;


    sr.followupDate =
      $("followupDate")
        ?.value ||
      "";


    sr.nextAction =
      $("nextAction")
        ?.value ||
      "";


    sr.resolution =
      $("resolution")
        ?.value ||
      "";


    sr.notes =
      $("notes")
        ?.value ||
      "";


    sr.closeReady =
      Boolean(
        $("closeReady")
          ?.checked
      );


    const update = {

      id:
        sr.id,

      date:
        todayISO(),

      action:
        sr.nextAction,

      stage:
        sr.myStage,

      notes:
        sr.notes,

      type:
        sr.myStage ===
        "Closed in Tracker"
          ? "closed"
          : "update"

    };


    state.updates.push(
      update
    );


    render();


    closeModal();


    alert(
      `Work update saved for ${sr.id}.`
    );

  }


  /* =========================================================
     AI API
     ========================================================= */

  async function callAI(
    endpoint,
    body
  ) {

    const response =
      await fetch(
        API_BASE +
        endpoint,
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify(
              body
            )

        }
      );


    let data;


    try {

      data =
        await response.json();

    } catch {

      throw new Error(
        "Cloudflare returned an invalid response."
      );

    }


    if (!response.ok) {

      throw new Error(
        data?.error ||
        `AI request failed (${response.status})`
      );

    }


    return data;

  }


  /* =========================================================
     AI CLOSURE PLAN
     ========================================================= */

  async function requestClosurePlan() {

    if (
      !state.requests.length
    ) {

      alert(
        "Import your SR CSV first."
      );

      return;

    }


    const container =
      $("aiSuggestions");


    if (container) {

      container.innerHTML =
        `<div class="ai-loading">
          🤖 Gemini is analyzing your SR backlog...
        </div>`;

    }


    try {

      const result =
        await callAI(
          "/api/ai/closure-plan",
          {
            requests:
              state.requests
          }
        );


      state.aiSuggestions =
        result.recommendations ||
        [];


      renderAISuggestions();


    } catch (error) {

      console.error(
        "AI closure plan error:",
        error
      );


      if (container) {

        container.innerHTML =
          `<div class="empty">
            ❌ ${escapeHTML(
              error.message
            )}
          </div>`;

      }

    }

  }


  function renderAISuggestions() {

    const container =
      $("aiSuggestions");


    if (!container) {
      return;
    }


    if (
      !state.aiSuggestions.length
    ) {

      container.innerHTML =
        `<div class="empty">
          Gemini did not return recommendations.
        </div>`;

      return;

    }


    container.innerHTML =
      state.aiSuggestions
        .map(
          item => `

            <div class="ai-suggestion">

              <div class="ai-rank">
                ${escapeHTML(
                  item.rank
                )}
              </div>


              <div>

                <h4>
                  ${escapeHTML(
                    item.requestId
                  )}
                </h4>

                <p>
                  ${escapeHTML(
                    item.reason ||
                    ""
                  )}
                </p>

                <div class="ai-reason">
                  ${escapeHTML(
                    item.nextAction ||
                    ""
                  )}
                </div>

                <p>
                  Evidence:
                  ${escapeHTML(
                    item.closureEvidence ||
                    "-"
                  )}
                </p>

              </div>


              <button
                class="ghost"
                data-action="work"
                data-id="${escapeHTML(
                  item.requestId
                )}"
              >
                Work
              </button>

            </div>

          `
        )
        .join("");

  }


  /* =========================================================
     AI NEXT STEP
     ========================================================= */

  async function requestNextStep() {

    const sr =
      state.currentSR;


    if (!sr) {
      return;
    }


    const container =
      $("aiWorkSuggestion");


    if (container) {

      container.innerHTML =
        `<div class="ai-loading">
          🤖 Gemini is analyzing this SR...
        </div>`;

    }


    try {

      const result =
        await callAI(
          "/api/ai/next-step",
          {
            sr
          }
        );


      if (container) {

        container.innerHTML = `

          <strong>
            ${escapeHTML(
              result.nextAction ||
              "Next action"
            )}
          </strong>

          <br><br>

          <b>
            Closure chance:
          </b>

          ${escapeHTML(
            result.closureChance ||
            "-"
          )}

          <br>

          <b>
            Estimated:
          </b>

          ${escapeHTML(
            result.estimatedMinutes ||
            "-"
          )} minutes

          <br><br>

          <b>
            Evidence:
          </b>

          ${escapeHTML(
            result.closureEvidence ||
            "-"
          )}

          <br><br>

          <b>
            Requester message:
          </b>

          ${escapeHTML(
            result.requesterMessage ||
            "-"
          )}

        `;

      }

    } catch (error) {

      console.error(
        "AI next-step error:",
        error
      );


      if (container) {

        container.innerHTML =
          `❌ ${escapeHTML(
            error.message
          )}`;

      }

    }

  }


  /* =========================================================
     AI CHAT
     ========================================================= */

  function createAIChat() {

    if (
      $("srAiChatPanel")
    ) {

      return;

    }


    const button =
      document.createElement(
        "button"
      );


    button.id =
      "srAiChatButton";

    button.className =
      "ai-chat-button";

    button.type =
      "button";

    button.innerHTML =
      `
        <span>✦</span>
        <b>AI</b>
      `;


    document.body.appendChild(
      button
    );


    const panel =
      document.createElement(
        "div"
      );


    panel.id =
      "srAiChatPanel";

    panel.className =
      "ai-chat-panel";


    panel.innerHTML = `

      <div class="ai-chat-header">

        <div class="ai-chat-title">

          <div class="ai-chat-avatar">
            ✦
          </div>

          <div>

            <strong>
              SR AI Assistant
            </strong>

            <span>
              IT Helpdesk Closure Copilot
            </span>

          </div>

        </div>


        <button
          id="srAiChatClose"
          class="ai-chat-close"
        >
          ×
        </button>

      </div>


      <div
        id="srAiChatMessages"
        class="ai-chat-messages"
      >

        <div class="ai-message">

          <div class="ai-message-avatar">
            AI
          </div>

          <div class="ai-message-content">

            <div class="ai-message-name">
              SR AI Assistant
            </div>

            <div class="ai-message-bubble">

              Hi! I'm your SR Closure AI Assistant.

              <br><br>

              I can analyze your imported SRs
              and help you decide what to close next.

            </div>

          </div>

        </div>

      </div>


      <div class="ai-chat-suggestions">

        <button
          data-chat="What SRs should I close first?"
        >
          What should I close first?
        </button>

        <button
          data-chat="Show me the oldest open SRs."
        >
          Oldest SRs
        </button>

        <button
          data-chat="Find quick wins in my SR backlog."
        >
          Quick wins
        </button>

        <button
          data-chat="Which SRs need requester follow-up?"
        >
          Requester follow-up
        </button>

      </div>


      <div class="ai-chat-input-area">

        <input
          id="srAiChatInput"
          class="ai-chat-input"
          placeholder="Ask about your SRs..."
        >

        <button
          id="srAiChatSend"
          class="ai-chat-send"
        >
          ➤
        </button>

      </div>

    `;


    document.body.appendChild(
      panel
    );


    const close =
      $("srAiChatClose");


    const messages =
      $("srAiChatMessages");


    const input =
      $("srAiChatInput");


    const send =
      $("srAiChatSend");


    button.onclick =
      () =>
        panel.classList.add(
          "open"
        );


    close.onclick =
      () =>
        panel.classList.remove(
          "open"
        );


    async function chat(
      customMessage = null
    ) {

      const message =
        String(
          customMessage ??
          input.value ??
          ""
        ).trim();


      if (!message) {
        return;
      }


      input.value =
        "";


      addChatMessage(
        messages,
        message,
        "user"
      );


      showChatThinking(
        messages
      );


      send.disabled =
        true;

      input.disabled =
        true;


      try {

        const context = {

          totalRequests:
            state.requests.length,

          dashboard:
            getStats(),

          requests:
            state.requests
              .slice(0, 100)
              .map(
                sr => ({

                  id:
                    sr.id,

                  subject:
                    sr.subject,

                  requester:
                    sr.requester,

                  status:
                    sr.status,

                  priority:
                    sr.priority,

                  site:
                    sr.site,

                  category:
                    sr.category,

                  ageDays:
                    sr.ageDays,

                  staleDays:
                    sr.staleDays,

                  stage:
                    sr.myStage,

                  nextAction:
                    sr.nextAction,

                  resolution:
                    sr.resolution,

                  notes:
                    sr.notes

                })
              )

        };


        const result =
          await callAI(
            "/api/ai/chat",
            {
              message,
              context
            }
          );


        removeChatThinking();


        addChatMessage(
          messages,
          result.reply ||
            "No response returned.",
          "ai"
        );


      } catch (error) {

        removeChatThinking();


        addChatMessage(
          messages,
          "❌ " +
            (
              error.message ||
              "AI chat failed."
            ),
          "ai"
        );

      } finally {

        send.disabled =
          false;

        input.disabled =
          false;

        input.focus();

      }

    }


    send.onclick =
      () =>
        chat();


    input.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          event.preventDefault();

          chat();

        }

      }
    );


    panel
      .querySelectorAll(
        "[data-chat]"
      )
      .forEach(
        button => {

          button.onclick =
            () =>
              chat(
                button.dataset.chat
              );

        }
      );

  }


  function addChatMessage(
    container,
    text,
    type
  ) {

    const item =
      document.createElement(
        "div"
      );


    item.className =
      type === "user"
        ? "ai-message ai-message-user"
        : "ai-message";


    const avatar =
      type === "user"
        ? "You"
        : "AI";


    item.innerHTML = `

      <div class="ai-message-avatar">
        ${avatar}
      </div>

      <div class="ai-message-content">

        <div class="ai-message-name">
          ${
            type === "user"
              ? "You"
              : "SR AI Assistant"
          }
        </div>

        <div class="ai-message-bubble">
          ${escapeHTML(
            text
          ).replace(
            /\n/g,
            "<br>"
          )}
        </div>

      </div>

    `;


    container.appendChild(
      item
    );


    container.scrollTop =
      container.scrollHeight;

  }


  function showChatThinking(
    container
  ) {

    removeChatThinking();


    const item =
      document.createElement(
        "div"
      );


    item.id =
      "aiThinkingMessage";


    item.className =
      "ai-message";


    item.innerHTML = `

      <div class="ai-message-avatar">
        AI
      </div>

      <div class="ai-message-content">

        <div class="ai-message-name">
          SR AI Assistant
        </div>

        <div class="ai-chat-thinking">

          <span></span>
          <span></span>
          <span></span>

        </div>

      </div>

    `;


    container.appendChild(
      item
    );


    container.scrollTop =
      container.scrollHeight;

  }


  function removeChatThinking() {

    $(
      "aiThinkingMessage"
    )?.remove();

  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function setupNavigation() {

    document
      .querySelectorAll(
        ".nav[data-view]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const view =
                button.dataset.view;


              document
                .querySelectorAll(
                  ".view"
                )
                .forEach(
                  section =>
                    section.classList.add(
                      "hidden"
                    )
                );


              const target =
                $(
                  view +
                  "View"
                );


              if (target) {

                target.classList.remove(
                  "hidden"
                );

              }


              document
                .querySelectorAll(
                  ".nav[data-view]"
                )
                .forEach(
                  item =>
                    item.classList.remove(
                      "active"
                    )
                );


              button.classList.add(
                "active"
              );


              if ($("pageTitle")) {

                $("pageTitle")
                  .textContent =
                  button.textContent.trim();

              }


              if (
                view ===
                "queue"
              ) {

                renderQueue();

              }


              if (
                view ===
                "all"
              ) {

                renderAll();

              }


              if (
                view ===
                "updates"
              ) {

                renderUpdates();

              }


              if (
                view ===
                "reports"
              ) {

                renderReports();

              }

            }
          );

        }
      );

  }


  /* =========================================================
     EVENTS
     ========================================================= */

  function setupEvents() {

    $("aiSuggestBtn")
      ?.addEventListener(
        "click",
        requestClosurePlan
      );


    $("aiWorkBtn")
      ?.addEventListener(
        "click",
        requestNextStep
      );


    $("refreshBtn")
      ?.addEventListener(
        "click",
        render
      );


    $("targetInput")
      ?.addEventListener(
        "input",
        renderMission
      );


    $("queueFilter")
      ?.addEventListener(
        "change",
        renderQueue
      );


    $("stageFilter")
      ?.addEventListener(
        "change",
        renderQueue
      );


    $("queueSearch")
      ?.addEventListener(
        "input",
        renderQueue
      );


    $("allSearch")
      ?.addEventListener(
        "input",
        renderAll
      );


    $("catFilter")
      ?.addEventListener(
        "change",
        renderAll
      );


    $("siteFilter")
      ?.addEventListener(
        "change",
        renderAll
      );


    $("priorityFilter")
      ?.addEventListener(
        "change",
        renderAll
      );


    $("exportBtn")
      ?.addEventListener(
        "click",
        exportTracker
      );


    $("resetBtn")
      ?.addEventListener(
        "click",
        resetTracker
      );


    $("srForm")
      ?.addEventListener(
        "submit",
        event => {

          event.preventDefault();

          saveSRUpdate();

        }
      );


    document
      .querySelectorAll(
        "[data-close]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const id =
                button.dataset.close;

              if (
                id ===
                "srModal"
              ) {

                closeModal();

              }

            }
          );

        }
      );


    document.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-action]"
          );


        if (!button) {
          return;
        }


        if (
          button.dataset.action ===
          "work"
        ) {

          openWorkSR(
            button.dataset.id
          );

        }

      }
    );

  }


  /* =========================================================
     EXPORT
     ========================================================= */

  function exportTracker() {

    if (
      !state.requests.length
    ) {

      alert(
        "There are no SRs to export."
      );

      return;

    }


    const headers = [

      "Request ID",
      "Subject",
      "Requester",
      "Technician",
      "Status",
      "Priority",
      "Site",
      "Category",
      "Created",
      "Updated",
      "Age Days",
      "Stage",
      "Next Action",
      "Resolution",
      "Notes",
      "Follow-up Date",
      "Close Ready"

    ];


    const rows =
      state.requests.map(
        sr => [

          sr.id,
          sr.subject,
          sr.requester,
          sr.technician,
          sr.status,
          sr.priority,
          sr.site,
          sr.category,
          sr.created,
          sr.updated,
          sr.ageDays,
          sr.myStage,
          sr.nextAction,
          sr.resolution,
          sr.notes,
          sr.followupDate,
          sr.closeReady
            ? "Yes"
            : "No"

        ]
      );


    const csv = [

      headers,

      ...rows

    ]
      .map(
        row =>
          row
            .map(
              value =>
                `"${String(
                  value ??
                  ""
                ).replace(
                  /"/g,
                  '""'
                )}"`
            )
            .join(",")
      )
      .join("\n");


    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;

    link.download =
      "SR_Closure_Tracker.csv";


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
      url
    );

  }


  /* =========================================================
     RESET
     ========================================================= */

  function resetTracker() {

    if (
      !confirm(
        "Remove the imported SR data from this session?"
      )
    ) {

      return;

    }


    state.requests =
      [];

    state.updates =
      [];

    state.aiSuggestions =
      [];

    state.currentSR =
      null;

    state.importedFileName =
      "";


    render();


    alert(
      "SR tracker has been reset."
    );

  }


  /* =========================================================
     MASTER RENDER
     ========================================================= */

  function render() {

    renderDeadline();

    renderDashboard();

    renderQueue();

    renderAll();

    renderUpdates();

    renderReports();

    updateFilters();

  }


  /* =========================================================
     START APPLICATION
     ========================================================= */

  function init() {

    console.log(
      "🚀 SR Closure Manager starting..."
    );


    setupCSVInputs();

    setupNavigation();

    setupEvents();

    createAIChat();

    render();


    console.log(
      "✅ SR Closure Manager ready."
    );


    console.log(
      "📥 Waiting for CSV import..."
    );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }

})();