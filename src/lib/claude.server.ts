import type { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server";

const MODEL = "anthropic/claude-sonnet-5";

/** Calls Claude through the Lovable AI Gateway, asks for strict JSON, validates with zod. */
export async function claudeJSON<T>(opts: {
  system: string;
  user: string;
  /** Optional images (base64, no data: prefix) sent before the text. */
  images?: { mediaType: string; data: string }[];
  schema: Record<string, unknown>;
  validator: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured. [AI_CONFIG]");
  const gateway = createLovableAiGatewayRunIdFetch();
  console.info("AI request started", { model: MODEL, photos: opts.images?.length ?? 0 });
  const res = await gateway.fetch("https://ai.gateway.lovable.dev/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      stream: true,
      system: opts.system + "\nRespond ONLY with JSON matching the schema. No prose.",
      messages: [
        {
          role: "user",
          content: opts.images?.length
            ? [
                ...opts.images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mediaType, data: i.data } })),
                { type: "text", text: opts.user },
              ]
            : opts.user,
        },
      ],
      output_config: { format: { type: "json_schema", schema: opts.schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error("Claude error", res.status, body);
    let safeMessage = "";
    try { const error = JSON.parse(body); safeMessage = error.message ?? error.error?.message ?? ""; } catch { /* Non-JSON response. */ }
    if (safeMessage) throw new Error(`${safeMessage} [AI_${res.status}]`);
    if (res.status === 402) throw new Error("AI credits are used up. Please top up to continue. [AI_402]");
    if (res.status === 429) throw new Error("AI is busy right now. Please try again in a minute. [AI_429]");
    if (res.status === 403) throw new Error("AI access was denied for this request. [AI_403]");
    throw new Error(`The AI request could not complete. [AI_${res.status}]`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let stop: string | null = null;
  let complete = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let ev;
        try { ev = JSON.parse(payload); } catch { continue; }
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text;
        if (ev.type === "message_delta" && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
        if (ev.type === "message_stop") complete = true;
        if (ev.type === "error") {
          console.error("AI stream failed", ev.error);
          throw new Error(`${ev.error?.message ?? "AI stream interrupted."} [AI_STREAM]`);
        }
      }
    }
  }
  if (stop === "refusal") throw new Error("The AI declined this request. [AI_REFUSAL]");
  if (!complete) throw new Error("The AI connection ended before the answer was ready. [AI_INCOMPLETE]");

  let parsed: unknown;
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Bad JSON from Claude", text.slice(0, 500));
    throw new Error("The AI returned an unreadable answer. [AI_JSON]");
  }
  const v = opts.validator.safeParse(parsed);
  if (!v.success) {
    console.error("Validation failed", v.error.issues);
    throw new Error("The AI answer didn't match the expected format. [AI_FORMAT]");
  }
  console.info("AI request completed", { runId: gateway.getRunId(), model: MODEL });
  return v.data;
}
