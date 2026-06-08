import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "memory");
fs.mkdirSync(dataDir, { recursive: true });

const msgFile = path.join(dataDir, "messages.json");
const factFile = path.join(dataDir, "facts.json");
const summaryFile = path.join(dataDir, "summaries.json");

const MAX_L1 = 60;         // L1 缓冲区最多保留条数
const SUMMARIZE_EVERY = 40; // 每 40 条触发一次摘要压缩
const MAX_FACTS = 30;      // 最多保留的事实数

function readJSON(fp) {
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); }
  catch { return {}; }
}

function writeJSON(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

// ==================== L1: 短期缓冲区 ====================

export function saveMessage(userId, role, content) {
  const all = readJSON(msgFile);
  if (!all[userId]) all[userId] = [];
  all[userId].push({ role, content, time: Date.now() });
  // 保留最近 MAX_L1+50 条，多余的在压缩时清理
  if (all[userId].length > MAX_L1 + 100) {
    all[userId] = all[userId].slice(-MAX_L1);
  }
  writeJSON(msgFile, all);
}

export function getRecentMessages(userId, limit = 40) {
  const all = readJSON(msgFile);
  const msgs = all[userId] || [];
  return msgs.slice(-limit).map(m => ({ role: m.role, content: m.content }));
}

export function getMessageCount(userId) {
  const all = readJSON(msgFile);
  return (all[userId] || []).length;
}

// 获取需要被压缩的旧消息（older than last N）
export function getOldMessages(userId, keepRecent = 20) {
  const all = readJSON(msgFile);
  const msgs = all[userId] || [];
  if (msgs.length <= keepRecent) return [];
  return msgs.slice(0, msgs.length - keepRecent);
}

// 删除已压缩的旧消息
export function trimMessages(userId, keepRecent = 20) {
  const all = readJSON(msgFile);
  if (!all[userId]) return;
  all[userId] = (all[userId]).slice(-keepRecent);
  writeJSON(msgFile, all);
}

// ==================== L2: 对话摘要 ====================

export function getSummaries(userId) {
  const all = readJSON(summaryFile);
  return all[userId] || [];
}

export function saveSummary(userId, text) {
  const all = readJSON(summaryFile);
  if (!all[userId]) all[userId] = [];
  all[userId].push({ text, time: Date.now() });
  // 最多保留 10 条摘要
  if (all[userId].length > 10) all[userId] = all[userId].slice(-10);
  writeJSON(summaryFile, all);
}

export function needsSummarization(userId) {
  const all = readJSON(msgFile);
  const msgs = all[userId] || [];
  const lastSummary = getLastSummaryTime(userId);
  // 如果上次摘要后新增消息超过阈值，需要再压缩
  const newMsgs = lastSummary
    ? msgs.filter(m => m.time > lastSummary)
    : msgs;
  return newMsgs.length >= SUMMARIZE_EVERY;
}

function getLastSummaryTime(userId) {
  const summaries = getSummaries(userId);
  if (summaries.length === 0) return 0;
  return summaries[summaries.length - 1].time;
}

// ==================== L3: 用户事实 ====================

export function saveFact(userId, key, value) {
  const all = readJSON(factFile);
  if (!all[userId]) all[userId] = {};
  // 如果已有同名 key，value 不同才更新
  all[userId][key] = { value, time: Date.now() };
  writeJSON(factFile, all);
}

export function getFacts(userId) {
  const all = readJSON(factFile);
  const facts = all[userId] || {};
  return Object.entries(facts)
    .sort((a, b) => b[1].time - a[1].time)
    .slice(0, MAX_FACTS)
    .map(([key, obj]) => ({ key, value: obj.value, time: obj.time }));
}

export function removeFact(userId, key) {
  const all = readJSON(factFile);
  if (all[userId]) {
    delete all[userId][key];
    writeJSON(factFile, all);
  }
}

// 批量保存事实，减少文件 IO
export function saveFactsBatch(userId, facts) {
  if (!facts || facts.length === 0) return;
  const all = readJSON(factFile);
  if (!all[userId]) all[userId] = {};
  for (const f of facts) {
    if (f.key && f.value) {
      all[userId][f.key] = { value: f.value, time: Date.now() };
    }
  }
  writeJSON(factFile, all);
}

// ==================== 综合上下文构建 ====================

export function buildContext(userId) {
  const l1Messages = getRecentMessages(userId, 40);
  const l2Summaries = getSummaries(userId);
  const l3Facts = getFacts(userId);

  let contextParts = [];

  // L3: 长期事实
  if (l3Facts.length > 0) {
    const factStr = l3Facts
      .slice(0, 15)
      .map(f => `[${f.key}]: ${f.value}`)
      .join("\n");
    contextParts.push(`## 关于老板，你记住这些\n${factStr}`);
  }

  // L2: 历史摘要
  if (l2Summaries.length > 0) {
    const recentSummaries = l2Summaries.slice(-5);
    const summaryStr = recentSummaries
      .map(s => s.text)
      .join("\n");
    if (summaryStr.trim()) {
      contextParts.push(`## 最近的对话历史摘要\n${summaryStr}`);
    }
  }

  return {
    contextText: contextParts.join("\n\n"),
    l1Messages,
  };
}

// 获取需要压缩的对话（给 AI 生成摘要用）
export function getMessagesForSummarization(userId) {
  const old = getOldMessages(userId, 20);
  if (old.length === 0) return "";
  return old
    .map(m => `${m.role === "user" ? "老板" : "蓝梦"}: ${m.content.slice(0, 200)}`)
    .join("\n");
}
