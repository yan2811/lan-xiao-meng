import { buildSystemPrompt, getUserNickname, getCharacterName } from "./personality.js";
import { chat } from "./ai-client.js";
import { saveMessage, getRecentMessages, getOrCreateSummary } from "./memory.js";

export async function handleMessage(userId, userMessage) {
  // 保存用户消息
  saveMessage(userId, "user", userMessage);

  // 获取历史消息和记忆
  const history = getRecentMessages(userId, 30);
  const facts = getOrCreateSummary(userId);

  // 构建系统 Prompt
  let systemPrompt = buildSystemPrompt();

  // 注入用户记忆
  if (facts.length > 0) {
    const factLines = facts
      .map((f) => `（记忆：${f.key} = ${f.value}）`)
      .join("\n");
    systemPrompt += `\n\n## 关于老板，你记得这些\n${factLines}`;
  }

  // 构建消息列表
  const messages = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  // 调用 Claude
  const reply = await chat(systemPrompt, messages);

  // 保存回复
  saveMessage(userId, "assistant", reply);

  // 自动提取并记录用户信息
  await autoExtractFacts(userId, systemPrompt, userMessage);

  return reply;
}

async function autoExtractFacts(userId, systemPrompt, userMessage) {
  // 用一次轻量调用提取用户信息
  const extractPrompt = `从用户说的话中提取值得记住的信息（如名字、喜好、重要事件等）。
如果没有新信息则返回空 JSON 数组。只返回 JSON，不要其他内容。

用户说："${userMessage.slice(0, 200)}"

返回格式：[{"key": "主题", "value": "内容"}]`;

  try {
    const result = await chat(
      "你是一个信息提取助手。只输出 JSON，不输出其他内容。",
      [{ role: "user", content: extractPrompt }],
      { maxTokens: 200 }
    );
    const parsed = JSON.parse(result);
    for (const fact of parsed) {
      if (fact.key && fact.value) {
        const { saveFact } = await import("./memory.js");
        saveFact(userId, fact.key, fact.value);
      }
    }
  } catch {
    // 静默忽略提取失败
  }
}
