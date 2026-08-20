const MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

/* =========================================================
   Common JSON response
   ========================================================= */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

/* =========================================================
   Gemini API
   ========================================================= */

async function callGemini(env, model, prompt, jsonMode = false) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in Cloudflare");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const generationConfig = {
    temperature: 0.2
  };

  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig
    })
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Gemini returned an invalid server response");
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
      `Gemini API request failed with status ${response.status}`
    );

    error.status = response.status;
    throw error;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

/* =========================================================
   JSON extractor
   ========================================================= */

function extractJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("Gemini returned invalid JSON");
  }
}

/* =========================================================
   JSON AI generation
   ========================================================= */

async function generate(env, prompt) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await callGemini(
        env,
        MODEL,
        prompt,
        true
      );

      return extractJson(text);

    } catch (err) {
      lastError = err;

      console.error(
        `Gemini primary attempt ${attempt} failed:`,
        err.message
      );

      if (err.status !== 429 && err.status !== 503) {
        throw err;
      }

      if (attempt < 2) {
        await new Promise(resolve =>
          setTimeout(resolve, 1800)
        );
      }
    }
  }

  if (
    FALLBACK_MODEL &&
    FALLBACK_MODEL !== MODEL
  ) {
    try {
      console.log(
        `Trying fallback model: ${FALLBACK_MODEL}`
      );

      const text = await callGemini(
        env,
        FALLBACK_MODEL,
        prompt,
        true
      );

      return extractJson(text);

    } catch (err) {
      lastError = err;

      console.error(
        "Fallback model failed:",
        err.message
      );
    }
  }

  if (
    lastError?.status === 429 ||
    lastError?.status === 503
  ) {
    throw new Error(
      "Gemini is temporarily busy or rate-limited. Please try again."
    );
  }

  throw lastError ||
    new Error("Gemini analysis failed");
}

/* =========================================================
   CHAT AI
   ========================================================= */

async function generateChat(env, message, context) {
  const safeContext = {
    today: context?.today || "",
    target: context?.target || 10,
    closedToday: context?.closedToday || 0,
    openCount: context?.openCount || 0,
    deadline: context?.deadline || "2027-01-01",

    requests: Array.isArray(context?.requests)
      ? context.requests.slice(0, 80)
      : []
  };

  const prompt = `
You are "SR AI Assistant", an expert IT Helpdesk Service Request
Closure Copilot.

You are assisting a technician who manages service requests.

Your job is to answer questions about the technician's SR backlog,
prioritize work, explain next steps, identify SLA risks, suggest
legitimate closure actions, and draft requester messages.

IMPORTANT RULES:

1. Never invent a resolution.
2. Never claim that an SR is fixed unless the supplied data proves it.
3. Never recommend false closure.
4. Do not fabricate SR numbers, dates, users, sites or technical facts.
5. If the data does not contain enough information, clearly say so.
6. Prefer practical IT helpdesk actions.
7. For closure recommendations, explain what evidence or requester
   confirmation is required.
8. If an SR is waiting for requester/vendor, say that clearly.
9. If the user asks "what should I close first", prioritize legitimate
   quick wins while considering age, stale updates, readiness and blockers.
10. Keep answers concise and useful.
11. You can refer to the supplied SR data directly.
12. You are an assistant, not an authority to falsely close tickets.

CURRENT DASHBOARD:

${JSON.stringify(safeContext, null, 2)}

USER QUESTION:

${message}

Answer naturally like an experienced IT Helpdesk team lead.

When useful, structure the response using short headings and bullet
points.

If discussing a specific SR, include its SR ID.

Do not return JSON.
Return normal human-readable text.
`;

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await callGemini(
        env,
        MODEL,
        prompt,
        false
      );

    } catch (err) {
      lastError = err;

      console.error(
        `Chat Gemini attempt ${attempt} failed:`,
        err.message
      );

      if (err.status !== 429 && err.status !== 503) {
        throw err;
      }

      if (attempt < 2) {
        await new Promise(resolve =>
          setTimeout(resolve, 1800)
        );
      }
    }
  }

  if (
    FALLBACK_MODEL &&
    FALLBACK_MODEL !== MODEL
  ) {
    try {
      console.log(
        `Chat using fallback model: ${FALLBACK_MODEL}`
      );

      return await callGemini(
        env,
        FALLBACK_MODEL,
        prompt,
        false
      );

    } catch (err) {
      lastError = err;
    }
  }

  if (
    lastError?.status === 429 ||
    lastError?.status === 503
  ) {
    throw new Error(
      "Gemini is temporarily busy. Please wait a moment and try again."
    );
  }

  throw lastError ||
    new Error("AI chat failed");
}

/* =========================================================
   AI CHAT ROUTE
   ========================================================= */

async function chat(request, env) {
  const body = await request.json();

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  if (!message) {
    return json(
      {
        error: "Chat message is required"
      },
      400
    );
  }

  if (message.length > 2000) {
    return json(
      {
        error: "Chat message is too long"
      },
      400
    );
  }

  const context =
    body.context &&
    typeof body.context === "object"
      ? body.context
      : {};

  const reply = await generateChat(
    env,
    message,
    context
  );

  return json({
    ok: true,
    reply
  });
}

/* =========================================================
   AI CLOSURE PLAN
   ========================================================= */

async function closurePlan(request, env) {
  const body = await request.json();

  const requests =
    Array.isArray(body.requests)
      ? body.requests
      : [];

  if (!requests.length) {
    return json(
      {
        error: "No SRs supplied"
      },
      400
    );
  }

  const simplified = requests.map(sr => ({
    id: sr.id,
    subject: sr.subject,
    requester: sr.requester,
    technician: sr.technician,
    status: sr.status,
    priority: sr.priority,
    site: sr.site,
    category: sr.category,
    created: sr.created,
    updated: sr.updated,
    ageDays: sr.ageDays,
    stage: sr.myStage,
    nextAction: sr.nextAction,
    resolution: sr.resolution,
    notes: sr.notes
  }));

  const prompt = `
You are an expert IT Helpdesk Service Request Closure Assistant.

Your goal is to help a technician legitimately close as many service
requests as possible.

Rank the best 10 SRs to work on first.

Rules:

- Never invent that an issue is fixed.
- Never recommend false closure.
- Prefer quick legitimate wins.
- Prefer requester-confirmation cases.
- Consider age.
- Consider stale updates.
- Consider current stage.
- Consider subject.
- Consider blockers.
- Consider likely effort.
- Old SRs matter, but do not prioritize an old blocked SR over a
  simple closable SR.
- Give a concrete next action.
- State exactly what evidence or confirmation is needed.
- If requester/vendor action is needed, say so.
- Only recommend closure when the supplied data supports it.

Return ONLY JSON:

{
  "recommendations": [
    {
      "rank": 1,
      "requestId": "SR-ID",
      "closureChance": "High",
      "estimatedMinutes": 10,
      "reason": "short reason",
      "nextAction": "specific action",
      "closureEvidence": "required evidence",
      "suggestedMessage": "short requester message",
      "risk": "Low"
    }
  ]
}

SR DATA:

${JSON.stringify(simplified, null, 2)}
`;

  return json(
    await generate(env, prompt)
  );
}

/* =========================================================
   AI NEXT STEP
   ========================================================= */

async function nextStep(request, env) {
  const body = await request.json();

  const sr = body.sr;

  if (!sr) {
    return json(
      {
        error: "SR data is required"
      },
      400
    );
  }

  const prompt = `
You are an IT Helpdesk closure assistant.

Analyze this one service request and give the fastest legitimate
next step.

Never invent a resolution.

Do not say the issue is fixed unless the supplied data proves it.

Return ONLY JSON:

{
  "priority": "High|Medium|Low",
  "closureChance": "High|Medium|Low",
  "estimatedMinutes": 10,
  "nextAction": "What technician should do next",
  "requesterMessage": "Short message to requester",
  "closureEvidence": "What must be confirmed before closure",
  "resolutionTemplate": "Resolution text template",
  "reason": "Why this is recommended"
}

SR:

${JSON.stringify(sr, null, 2)}
`;

  return json(
    await generate(env, prompt)
  );
}

/* =========================================================
   CLOUDFLARE WORKER
   ========================================================= */

export default {

  async fetch(request, env) {

    const url = new URL(request.url);

    /* -----------------------------------------------------
       CORS
       ----------------------------------------------------- */

    if (request.method === "OPTIONS") {

      return new Response(null, {
        status: 204,

        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type"
        }
      });

    }

    try {

      /* ---------------------------------------------------
         HEALTH CHECK
         --------------------------------------------------- */

      if (
        url.pathname === "/api/health" &&
        request.method === "GET"
      ) {

        return json({
          ok: true,
          ai: Boolean(env.GEMINI_API_KEY),
          provider: "Google Gemini",
          model: MODEL,
          fallbackModel: FALLBACK_MODEL
        });

      }

      /* ---------------------------------------------------
         AI CHAT
         --------------------------------------------------- */

      if (
        url.pathname === "/api/ai/chat" &&
        request.method === "POST"
      ) {

        return await chat(
          request,
          env
        );

      }

      /* ---------------------------------------------------
         AI CLOSURE PLAN
         --------------------------------------------------- */

      if (
        url.pathname === "/api/ai/closure-plan" &&
        request.method === "POST"
      ) {

        return await closurePlan(
          request,
          env
        );

      }

      /* ---------------------------------------------------
         AI NEXT STEP
         --------------------------------------------------- */

      if (
        url.pathname === "/api/ai/next-step" &&
        request.method === "POST"
      ) {

        return await nextStep(
          request,
          env
        );

      }

      /* ---------------------------------------------------
         STATIC FILES
         --------------------------------------------------- */

      if (env.ASSETS) {

        return await env.ASSETS.fetch(
          request
        );

      }

      return json(
        {
          error:
            "Static assets binding is not configured"
        },
        500
      );

    } catch (err) {

      console.error(
        "Worker error:",
        err
      );

      return json(
        {
          error:
            err?.message ||
            "Internal server error"
        },
        500
      );

    }

  }

};