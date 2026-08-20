var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var MODEL = "gemini-3.6-flash";
var FALLBACK_MODEL = "gemini-2.5-flash-lite";
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
__name(json, "json");
async function callGemini(env, model, prompt, jsonMode = false) {
  if (!env.GEMINI_API_KEY) {
    const error = new Error(
      "GEMINI_API_KEY is not configured in Cloudflare"
    );
    error.status = 500;
    throw error;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
    const error = new Error(
      "Gemini returned an invalid server response"
    );
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const message = data?.error?.message || `Gemini API request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    console.error(
      "Gemini API error:",
      message
    );
    throw error;
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim();
  if (!text) {
    console.error(
      "Gemini returned:",
      JSON.stringify(data)
    );
    throw new Error(
      "Gemini returned an empty response"
    );
  }
  return text;
}
__name(callGemini, "callGemini");
function extractJson(text) {
  const cleaned = String(text || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(
          cleaned.slice(
            start,
            end + 1
          )
        );
      } catch {
        throw new Error(
          "Gemini returned invalid JSON"
        );
      }
    }
    throw new Error(
      "Gemini returned invalid JSON"
    );
  }
}
__name(extractJson, "extractJson");
async function generateJSON(env, prompt) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await callGemini(
        env,
        MODEL,
        prompt,
        true
      );
      return extractJson(
        text
      );
    } catch (err) {
      lastError = err;
      console.error(
        `Primary Gemini attempt ${attempt} failed:`,
        err.message
      );
      if (err.status !== 429 && err.status !== 503) {
        throw err;
      }
      if (attempt < 2) {
        await new Promise(
          (resolve) => setTimeout(
            resolve,
            1800
          )
        );
      }
    }
  }
  try {
    const text = await callGemini(
      env,
      FALLBACK_MODEL,
      prompt,
      true
    );
    return extractJson(
      text
    );
  } catch (err) {
    lastError = err;
    console.error(
      "Fallback Gemini model failed:",
      err.message
    );
  }
  throw lastError || new Error(
    "Gemini analysis failed"
  );
}
__name(generateJSON, "generateJSON");
async function generateChat(env, prompt) {
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
        await new Promise(
          (resolve) => setTimeout(
            resolve,
            1500
          )
        );
      }
    }
  }
  try {
    return await callGemini(
      env,
      FALLBACK_MODEL,
      prompt,
      false
    );
  } catch (err) {
    lastError = err;
    console.error(
      "Fallback chat model failed:",
      err.message
    );
  }
  throw lastError || new Error(
    "Gemini chat failed"
  );
}
__name(generateChat, "generateChat");
async function aiChat(request, env) {
  const body = await request.json();
  const message = String(
    body?.message || ""
  ).trim();
  if (!message) {
    return json(
      {
        error: "Chat message is required"
      },
      400
    );
  }
  const context = body?.context || {};
  const prompt = `You are "SR AI Assistant", an expert IT Helpdesk Service Request Closure Copilot.

You are assisting a technician who wants to legitimately reduce an IT service-request backlog.

IMPORTANT RULES:

1. Never invent that an SR is fixed.
2. Never recommend false closure.
3. Never claim requester confirmation exists unless the supplied data says so.
4. If evidence or requester confirmation is needed, clearly say so.
5. Prioritize quick legitimate wins.
6. Consider age, stale updates, stage, priority, subject and blockers.
7. If an SR is waiting for requester or vendor, explain that clearly.
8. Give practical actions the technician can actually perform.
9. You can summarize the supplied SR data.
10. Do not expose API keys, secrets or internal credentials.
11. Keep the response concise and useful.
12. If the user asks "what should I close first", identify actual SR IDs from the supplied data.
13. Do not invent SR IDs.

CURRENT DASHBOARD:

${JSON.stringify(
    context.dashboard || {},
    null,
    2
  )}

TOTAL IMPORTED SRs:

${JSON.stringify(
    context.totalRequests || 0
  )}

SR DATA:

${JSON.stringify(
    context.requests || [],
    null,
    2
  )}

TECHNICIAN QUESTION:

${message}

Answer directly as the SR AI Assistant.

If recommending SRs, use this style:

1. SR-ID \u2014 short reason
   Next action: ...
   Closure evidence: ...

Then add a short overall recommendation if useful.`;
  const reply = await generateChat(
    env,
    prompt
  );
  return json({
    reply
  });
}
__name(aiChat, "aiChat");
async function closurePlan(request, env) {
  const body = await request.json();
  const requests = Array.isArray(
    body.requests
  ) ? body.requests : [];
  if (!requests.length) {
    return json(
      {
        error: "No SRs supplied"
      },
      400
    );
  }
  const simplified = requests.map(
    (sr) => ({
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
    })
  );
  const prompt = `You are an expert IT Helpdesk Service Request Closure Assistant.

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

${JSON.stringify(
    simplified,
    null,
    2
  )}`;
  const result = await generateJSON(
    env,
    prompt
  );
  return json(
    result
  );
}
__name(closurePlan, "closurePlan");
async function nextStep(request, env) {
  const body = await request.json();
  const sr = body?.sr;
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

${JSON.stringify(
    sr,
    null,
    2
  )}`;
  const result = await generateJSON(
    env,
    prompt
  );
  return json(
    result
  );
}
__name(nextStep, "nextStep");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(
      request.url
    );
    if (request.method === "OPTIONS") {
      return new Response(
        null,
        {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        }
      );
    }
    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({
          ok: true,
          ai: Boolean(
            env.GEMINI_API_KEY
          ),
          provider: "Google Gemini",
          model: MODEL,
          fallbackModel: FALLBACK_MODEL
        });
      }
      if (url.pathname === "/api/ai/chat" && request.method === "POST") {
        return await aiChat(
          request,
          env
        );
      }
      if (url.pathname === "/api/ai/closure-plan" && request.method === "POST") {
        return await closurePlan(
          request,
          env
        );
      }
      if (url.pathname === "/api/ai/next-step" && request.method === "POST") {
        return await nextStep(
          request,
          env
        );
      }
      if (env.ASSETS) {
        return await env.ASSETS.fetch(
          request
        );
      }
      return json(
        {
          error: "Not found"
        },
        404
      );
    } catch (err) {
      console.error(
        "Worker error:",
        err
      );
      return json(
        {
          error: err?.message || "Internal server error"
        },
        err?.status || 500
      );
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
