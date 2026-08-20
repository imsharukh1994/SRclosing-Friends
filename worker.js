const MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

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
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        throw new Error("Gemini returned invalid JSON");
      }
    }

    throw new Error("Gemini returned invalid JSON");
  }
}

async function generateWithModel(env, model, prompt) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in Cloudflare");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Gemini returned an invalid server response");
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Gemini API request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;

    throw error;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return extractJson(text);
}

async function generate(env, prompt) {
  let lastError = null;

  // Try the primary model twice for temporary capacity/rate-limit errors.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await generateWithModel(env, MODEL, prompt);
    } catch (err) {
      lastError = err;

      console.error(
        `Primary Gemini attempt ${attempt} failed:`,
        err.message
      );

      // Invalid/authentication errors should not be retried.
      if (err.status !== 429 && err.status !== 503) {
        throw err;
      }

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1800));
      }
    }
  }

  // Try fallback model.
  if (FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
    try {
      console.log(
        `Primary model unavailable. Trying fallback: ${FALLBACK_MODEL}`
      );

      return await generateWithModel(
        env,
        FALLBACK_MODEL,
        prompt
      );
    } catch (err) {
      lastError = err;

      console.error(
        "Fallback Gemini model failed:",
        err.message
      );
    }
  }

  if (
    lastError?.status === 429 ||
    lastError?.status === 503
  ) {
    throw new Error(
      "Gemini is temporarily busy or rate-limited. Please wait 20–30 seconds and try again."
    );
  }

  throw lastError || new Error("Gemini analysis failed");
}

async function closurePlan(request, env) {
  const body = await request.json();

  const requests = Array.isArray(body.requests)
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

  const prompt = `You are an expert IT Helpdesk Service Request Closure Assistant.

Your goal is to help a technician legitimately close as many service requests as possible.

Rank the best 10 SRs to work on first.

Rules:
- Never invent that an issue is fixed.
- Never recommend false closure.
- Prefer quick legitimate wins and requester-confirmation cases.
- Consider age, stale updates, current stage, subject, blockers and likely effort.
- Old SRs matter, but do not prioritize an old blocked SR over a simple closable SR.
- Give a concrete next action.
- State exactly what evidence or confirmation is needed before closure.
- If requester/vendor action is needed, say so.
- Keep recommendations concise.
- Only recommend closure when the supplied SR information supports it.

Return ONLY JSON in this exact shape:

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

${JSON.stringify(simplified, null, 2)}`;

  const result = await generate(env, prompt);

  return json(result);
}

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

  const prompt = `You are an IT Helpdesk closure assistant.

Analyze this one service request and give the fastest legitimate next step.

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

${JSON.stringify(sr, null, 2)}`;

  const result = await generate(env, prompt);

  return json(result);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    try {
      // Health check
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

      // AI closure plan
      if (
        url.pathname === "/api/ai/closure-plan" &&
        request.method === "POST"
      ) {
        return await closurePlan(request, env);
      }

      // AI next step
      if (
        url.pathname === "/api/ai/next-step" &&
        request.method === "POST"
      ) {
        return await nextStep(request, env);
      }

      /*
       * IMPORTANT:
       * Everything that is not an /api/* request is served
       * from the Public directory configured as Cloudflare Assets.
       */
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return json(
        {
          error: "Static assets binding is not configured"
        },
        500
      );

    } catch (err) {
      console.error("Worker error:", err);

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