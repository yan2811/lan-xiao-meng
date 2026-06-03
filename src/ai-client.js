import OpenAI from "openai";

let client = null;

export function getClient() {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === "sk-your-deepseek-api-key") {
      throw new Error(
        "请先设置 DEEPSEEK_API_KEY 环境变量，或复制 .env.example 为 .env 并填入你的 API Key"
      );
    }
    client = new OpenAI({
      apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    });
  }
  return client;
}

export async function chat(systemPrompt, messages, options = {}) {
  const client = getClient();
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const maxTokens = options.maxTokens || 512;

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature: 0.85,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ],
  });

  return response.choices[0]?.message?.content || "";
}
