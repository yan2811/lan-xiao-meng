import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "memory");
fs.mkdirSync(dataDir, { recursive: true });

const msgFile = path.join(dataDir, "messages.json");
const factFile = path.join(dataDir, "facts.json");

const MAX_HISTORY = 200;

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ==================== 消息记忆 ====================

export function saveMessage(userId, role, content) {
  const all = readJSON(msgFile);
  if (!all[userId]) all[userId] = [];
  all[userId].push({
    role,
    content,
    time: Date.now(),
  });
  if (all[userId].length > MAX_HISTORY + 50) {
    all[userId] = all[userId].slice(-MAX_HISTORY);
  }
  writeJSON(msgFile, all);
}

export function getRecentMessages(userId, limit = 50) {
  const all = readJSON(msgFile);
  const msgs = all[userId] || [];
  return msgs.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
}

// ==================== 用户信息记忆 ====================

export function saveFact(userId, key, value) {
  const all = readJSON(factFile);
  if (!all[userId]) all[userId] = {};
  all[userId][key] = { value, time: Date.now() };
  writeJSON(factFile, all);
}

export function getFacts(userId) {
  const all = readJSON(factFile);
  const facts = all[userId] || {};
  return Object.entries(facts).map(([key, obj]) => ({ key, value: obj.value }));
}

export function getOrCreateSummary(userId) {
  const all = readJSON(msgFile);
  const msgs = all[userId] || [];

  if (msgs.length > 80) {
    const recent = msgs.slice(-30).filter((m) => m.role === "user");
    const summary = recent.map((m) => m.content.slice(0, 60)).join("；").slice(0, 500);
    if (summary) {
      saveFact(userId, "recent_topics", summary);
    }
  }

  return getFacts(userId);
}
