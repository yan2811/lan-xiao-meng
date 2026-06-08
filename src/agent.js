import { buildSystemPrompt } from "./personality.js";
import { chat } from "./ai-client.js";
import {
  saveMessage, getMessageCount, getRecentMessages,
  needsSummarization, saveSummary, trimMessages, getMessagesForSummarization,
  saveFact, getFacts, buildContext,
} from "./memory.js";
import { shouldSearch, searchWeb } from "./search.js";

// 跟踪上次提取事实的消息数，减少 API 调用
const factExtractCounter = new Map(); // userId → last count when extracted

export async function handleMessage(userId, userMessage) {
  // 保存消息
  saveMessage(userId, "user", userMessage);

  // ============ 联网搜索检测 ============
  let searchResult = null;
  if (shouldSearch(userMessage)) {
    const keywords = extractSearchKeywords(userMessage);
    if (keywords) {
      console.log("[蓝小梦] 搜索:", keywords);
      searchResult = await searchWeb(keywords);
      if (searchResult) {
        console.log("[蓝小梦] 搜索结果:", searchResult.slice(0, 80) + "...");
      }
    }
  }

  // ============ 检查是否需要压缩摘要 ============
  if (needsSummarization(userId)) {
    await trySummarize(userId);
  }

  // ============ 构建上下文 ============
  const { contextText, l1Messages } = buildContext(userId);
  let systemPrompt = buildSystemPrompt();
  if (contextText) {
    systemPrompt += "\n\n" + contextText;
  }
  // 注入搜索结果
  if (searchResult) {
    systemPrompt += `\n\n## 关于老板刚才提到的话题，你联网查到的信息\n${searchResult}\n\n用这些信息自然地回应老板，不要说"根据搜索结果"，就像你本来就知道一样。不要长篇大论地科普，自然地带入对话中。`;
  }

  // ============ 构建消息列表 ============
  const messages = l1Messages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  // ============ 调用 AI ============
  const reply = await chat(systemPrompt, messages);

  // 保存回复
  saveMessage(userId, "assistant", reply);

  // ============ 智能事实提取（每 20 条触发一次，减少 API 调用）============
  const currentCount = getMessageCount(userId);
  const lastExtracted = factExtractCounter.get(userId) || 0;
  if (currentCount - lastExtracted >= 20) {
    await tryExtractFacts(userId);
    factExtractCounter.set(userId, currentCount);
  }

  return reply;
}

// ==================== 对话摘要压缩 ====================
async function trySummarize(userId) {
  const raw = getMessagesForSummarization(userId);
  if (!raw || raw.length < 100) return;

  const prompt = `你是一个摘要助手。把下面的对话历史压缩成一段 150-250 字的中文摘要。重点保留：
- 老板提到的个人信息（称呼偏好、喜好、生日等）
- 重要事件和约定
- 蓝梦和老板之间的互动亮点
- 老板的情绪状态

对话：
${raw.slice(-3000)}

只输出摘要文本，不要其他内容。`;

  try {
    const summary = await chat(
      "你是一个摘要助手。输出纯文本，不要任何格式。",
      [{ role: "user", content: prompt }],
      { maxTokens: 400 }
    );
    if (summary && summary.length > 20) {
      saveSummary(userId, summary);
      trimMessages(userId, 20); // 压缩后清理旧消息
      console.log("[蓝小梦] 摘要已生成:", summary.slice(0, 60) + "...");
    }
  } catch (err) {
    console.error("[蓝小梦] 摘要生成失败:", err.message);
  }
}

// ==================== 搜索关键词提取 ====================
function extractSearchKeywords(text) {
  return text
    .replace(/[？?！!。.，,~～]+/g, " ")
    .replace(/(帮我|请|搜一下|查一下|搜索|什么是|什么叫|怎么样|为什么|是什么)/g, "")
    .trim()
    .slice(0, 120);
}

// ==================== 事实提取（合并最近对话一次分析）====================
async function tryExtractFacts(userId) {
  const recent = getRecentMessages(userId, 30);
  const existingFacts = getFacts(userId);

  const historyStr = recent
    .map(m => `${m.role === "user" ? "老板" : "蓝梦"}: ${m.content.slice(0, 200)}`)
    .join("\n");

  const existingStr = existingFacts.length > 0
    ? "已知信息：\n" + existingFacts.map(f => `- ${f.key}: ${f.value}`).join("\n")
    : "";

  const prompt = `分析对话，提取关于"老板"的新信息或更新的信息。

${existingStr}

最近对话：
${historyStr.slice(-3000)}

返回 JSON 数组。只包含新发现或已改变的信息（新增或更新，已存在且未变的不要返回）。
每个条目格式：{"key": "分类", "value": "具体内容"}

可提取的信息类型：
- 称呼偏好（老板喜欢被叫什么）
- 个人信息（名字、生日、职业等）
- 喜好（喜欢/讨厌的食物、活动、话题等）
- 重要事件（最近发生的事）
- 其他值得记住的

如果没有新信息，返回空数组 []。

只输出 JSON 数组，不要其他内容。`;

  try {
    const result = await chat(
      "你是一个信息提取助手。只输出 JSON 数组，不输出其他内容。",
      [{ role: "user", content: prompt }],
      { maxTokens: 300 }
    );
    // 尝试解析
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const fact of parsed) {
        if (fact.key && fact.value) {
          saveFact(userId, fact.key, fact.value);
        }
      }
      if (parsed.length > 0) {
        console.log(`[蓝小梦] 记住 ${parsed.length} 条新信息`);
      }
    }
  } catch {
    // 静默忽略
  }
}
