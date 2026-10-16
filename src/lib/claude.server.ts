import type { z } from "zod";

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
  if (!key) throw new Error("AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
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
    if (res.status === 402) throw new Error("AI credits are used up. Please top up to continue.");
    if (res.status === 429) throw new Error("AI is busy right now. Please try again in a minute.");
    if (res.status === 403) throw new Error("AI access was denied for this request.");
    throw new Error("The AI request failed. Please try again.");
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let stop: string | null = null;
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
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text;
          if (ev.type === "message_delta" && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
          if (ev.type === "error") throw new Error(ev.error?.message ?? "AI stream error");
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("AI")) throw e;
        }
      }
    }
  }
  if (stop === "refusal") throw new Error("The AI declined this request.");

  let parsed: unknown;
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Bad JSON from Claude", text.slice(0, 500));
    throw new Error("The AI returned an unreadable answer. Please try again.");
  }
  const v = opts.validator.safeParse(parsed);
  if (!v.success) {
    console.error("Validation failed", v.error.issues);
    throw new Error("The AI answer didn't match the expected format. Please try again.");
  }
  return v.data;
}
