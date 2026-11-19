export interface LLMProvider {
  name: string;
  complete(prompt: string): Promise<string>;
}

async function postWithRetry(url: string, init: RequestInit, attempts = 3): Promise<any> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();
    // Free tiers rate-limit aggressively: back off on 429/5xx.
    if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      continue;
    }
    throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);
  }
}

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  constructor(
    private apiKey: string,
    private model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
  ) {}
  async complete(prompt: string): Promise<string> {
    const data = await postWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      },
    );
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
}

export class GroqProvider implements LLMProvider {
  name = "groq";
  constructor(
    private apiKey: string,
    private model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  ) {}
  async complete(prompt: string): Promise<string> {
    const data = await postWithRetry("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    return data.choices?.[0]?.message?.content ?? "";
  }
}

export function createProvider(name: string): LLMProvider | null {
  if (name === "gemini" && process.env.GEMINI_API_KEY) return new GeminiProvider(process.env.GEMINI_API_KEY);
  if (name === "groq" && process.env.GROQ_API_KEY) return new GroqProvider(process.env.GROQ_API_KEY);
  return null;
}
