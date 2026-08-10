import {
  answerHasGrounding,
  buildAssistantInput,
  buildAssistantInstructions,
  buildRetrievalFallback,
  readGeminiOutputText,
  readOpenRouterOutputText,
  retrieveLegalChunks,
  toCitation,
  type LegalAssistantAudience,
  type LegalAssistantCaseContext,
  type LegalAssistantHistoryItem,
} from "@/lib/legal-assistant";

export const runtime = "edge";

interface AssistantRequest {
  message?: unknown;
  audience?: unknown;
  history?: unknown;
  caseContext?: unknown;
}

interface ModelAnswer {
  answer: string;
  model: string;
  provider: "OpenRouter" | "Gemini";
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeHistory(value: unknown): LegalAssistantHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const role = "role" in item ? item.role : null;
    const content = "content" in item ? item.content : null;
    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string" ||
      !content.trim()
    ) return [];
    return [{ role, content: content.trim().slice(0, 1800) }];
  });
}

function safeCaseContext(value: unknown): LegalAssistantCaseContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<LegalAssistantCaseContext>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.service !== "string" ||
    typeof candidate.status !== "string"
  ) return undefined;
  return {
    ...candidate,
    id: candidate.id.slice(0, 80),
    service: candidate.service.slice(0, 120),
    documents: candidate.documents?.slice(0, 12).map((item) => ({
      title: String(item.title).slice(0, 120),
      type: String(item.type).slice(0, 60),
      status: String(item.status).slice(0, 40),
    })),
    controls: candidate.controls?.slice(0, 20).map((item) => ({
      id: String(item.id).slice(0, 80),
      name: String(item.name).slice(0, 140),
      status: String(item.status).slice(0, 40),
      explanation: String(item.explanation).slice(0, 500),
    })),
  } as LegalAssistantCaseContext;
}

async function callOpenRouter({
  apiKey,
  model,
  audience,
  input,
  signal,
}: {
  apiKey: string;
  model: string;
  audience: LegalAssistantAudience;
  input: string;
  signal: AbortSignal;
}): Promise<ModelAnswer | null> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL?.trim()
        || "https://martyrs-foundation-poc.o-liliums45.chatgpt.site",
      "X-Title": "Martyrs Foundation Legal Assistant POC",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildAssistantInstructions(audience) },
        { role: "user", content: input },
      ],
      temperature: 0.1,
      max_tokens: 900,
    }),
    signal,
  });
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  const answer = readOpenRouterOutputText(payload);
  const selectedModel = payload && typeof payload === "object" && "model" in payload
    && typeof payload.model === "string"
    ? payload.model
    : model;
  return answer ? { answer, model: selectedModel, provider: "OpenRouter" } : null;
}

async function callGemini({
  apiKey,
  model,
  audience,
  input,
  signal,
}: {
  apiKey: string;
  model: string;
  audience: LegalAssistantAudience;
  input: string;
  signal: AbortSignal;
}): Promise<ModelAnswer | null> {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      system_instruction: buildAssistantInstructions(audience),
      input,
      generation_config: { thinking_level: "minimal" },
    }),
    signal,
  });
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  const answer = readGeminiOutputText(payload);
  return answer ? { answer, model, provider: "Gemini" } : null;
}

export async function POST(request: Request) {
  let body: AssistantRequest;
  try {
    body = await request.json() as AssistantRequest;
  } catch {
    return json({ error: "تعذر قراءة الطلب." }, 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1800) {
    return json({ error: "اكتب سؤالاً بين 1 و1800 حرف." }, 400);
  }
  const audience: LegalAssistantAudience = body.audience === "staff" ? "staff" : "citizen";
  const history = safeHistory(body.history);
  const caseContext = safeCaseContext(body.caseContext);
  const sources = retrieveLegalChunks(message, 4);
  const fallback = buildRetrievalFallback({
    audience,
    message,
    sources,
    caseContext,
  });

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if ((!openRouterKey && !geminiKey) || !sources.length) return json(fallback);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const input = buildAssistantInput({
    message,
    history,
    sources,
    caseContext,
  });
  try {
    const generated = openRouterKey
      ? await callOpenRouter({
          apiKey: openRouterKey,
          model: process.env.OPENROUTER_MODEL?.trim()
            || "nvidia/nemotron-3-nano-30b-a3b:free",
          audience,
          input,
          signal: controller.signal,
        })
      : await callGemini({
          apiKey: geminiKey!,
          model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
          audience,
          input,
          signal: controller.signal,
        });
    if (!generated) {
      return json({
        ...fallback,
        notice: "تعذر الوصول إلى النموذج الآن؛ تم عرض جواب الاسترجاع القانوني الموثق.",
      });
    }
    if (!answerHasGrounding(generated.answer, sources)) {
      return json({
        ...fallback,
        notice: "لم يُرجع النموذج جواباً يمكن إثباته بالمقاطع المسترجعة؛ تم عرض جواب الاسترجاع القانوني الموثق.",
      });
    }
    return json({
      mode: "llm",
      answer: generated.answer,
      citations: sources.slice(0, 4).map(toCitation),
      sources,
      model: generated.model,
      notice: `إجابة مولدة عبر ${generated.provider} بعد استرجاع المقاطع القانونية الأقرب. تتطلب مراجعة بشرية.`,
    });
  } catch {
    return json({
      ...fallback,
      notice: "انتهت مهلة النموذج أو تعذر الاتصال؛ تم عرض جواب الاسترجاع القانوني الموثق.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
