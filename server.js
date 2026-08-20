require("dotenv").config();
const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname)));

function extractJson(text) {
  const cleaned = String(text || "").trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); }
  catch {
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error("Gemini returned invalid JSON");
  }
}

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function generateWithModel(model, prompt){
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  });
  return extractJson(response.text);
}

async function generate(prompt){
  let lastError;

  // Retry transient Gemini capacity errors before switching models.
  for(let attempt=1; attempt<=2; attempt++){
    try{
      return await generateWithModel(MODEL, prompt);
    }catch(err){
      lastError=err;
      const status=Number(err?.status || err?.code || 0);
      if(status!==503 && status!==429) throw err;
      if(attempt<2) await sleep(1800);
    }
  }

  // If the primary model is temporarily busy, automatically use
  // a lighter fallback model instead of breaking the AI button.
  if(FALLBACK_MODEL && FALLBACK_MODEL!==MODEL){
    try{
      console.log(`Primary model unavailable. Trying fallback: ${FALLBACK_MODEL}`);
      return await generateWithModel(FALLBACK_MODEL, prompt);
    }catch(err){
      lastError=err;
    }
  }

  if(lastError?.status===503 || lastError?.status===429){
    throw new Error("Gemini is temporarily busy or rate-limited. Please wait 20–30 seconds and click Suggest Fast Closures again.");
  }
  throw lastError;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ai: true, provider: "Google Gemini", model: MODEL, fallbackModel: FALLBACK_MODEL });
});

app.post("/api/ai/closure-plan", async (req, res) => {
  try {
    const requests = Array.isArray(req.body.requests) ? req.body.requests : [];
    if (!requests.length) return res.status(400).json({ error: "No SRs supplied" });

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
- State exactly what evidence/confirmation is needed before closure.
- If requester/vendor action is needed, say so.
- Keep recommendations concise.

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

    res.json(await generate(prompt));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/next-step", async (req, res) => {
  try {
    const sr = req.body.sr;
    if (!sr) return res.status(400).json({ error: "SR data is required" });

    const prompt = `You are an IT Helpdesk closure assistant.
Analyze this one service request and give the fastest legitimate next step.
Never invent a resolution. Do not say it is fixed unless the supplied data proves it.

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

    res.json(await generate(prompt));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SR Closure Manager: http://localhost:${PORT}`);
  console.log(`AI provider: Google Gemini`);
  console.log(`Gemini model: ${MODEL}`);
});
