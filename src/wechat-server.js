import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { handleMessage } from "./agent.js";
import { getCharacterName, getUserNickname } from "./personality.js";
import { generateProactiveMessage } from "./proactive.js";
import { getFacts } from "./memory.js";

// ============================================================
// 蓝小梦 微信桥接 v3 (服务器版)
// - HTTP 网页显示二维码，远程扫码
// - 24h 在线，无需本地终端
// - 主动消息 + 联网搜索
// ============================================================

const PORT = process.env.PORT || 3721;
const ILINK_BASE = "https://ilinkai.weixin.qq.com";
const CHARACTER = getCharacterName();
const INACTIVE_MS = 5 * 60 * 1000;

let sdk = null;
let botInstance = null;
let proactiveEnabled = false;
let lastActivityTime = Date.now();
let lastUserMsg = "";
let proactiveTimer = null;

// ==================== HTTP 服务器 ====================
let qrCodeUrl = null;      // 二维码 URL
let loginStatus = "idle";  // idle | waiting | scanned | confirmed | failed
let loginMessage = "";
let accountId = null;

function getStatusPage() {
  const statusMap = {
    idle: { color: "#999", text: "等待启动", icon: "⏳" },
    waiting: { color: "#f0a500", text: "等待扫码", icon: "📱" },
    scanned: { color: "#4a90d9", text: "已扫码，微信上继续操作...", icon: "👀" },
    confirmed: { color: "#27ae60", text: "连接成功！", icon: "✅" },
    failed: { color: "#e74c3c", text: "登录失败", icon: "❌" },
  };
  const status = statusMap[loginStatus] || statusMap.idle;

  let body = "";
  if (qrCodeUrl && loginStatus === "waiting") {
    body = `
      <p style="font-size:18px;color:#333;margin:10px 0">请用微信扫描下方二维码</p>
      <img src="${qrCodeUrl}" alt="QR Code" style="width:280px;height:280px;border:3px solid #f0a500;border-radius:12px">
      <p style="color:#888;font-size:13px;margin-top:10px">微信 → ClawBot 插件 → 扫码授权</p>
      <p style="color:#aaa;font-size:12px">二维码每 5 分钟自动刷新</p>
      <script>setTimeout(()=>location.reload(), 120000)</script>
    `;
  } else if (loginStatus === "scanned") {
    body = `<p style="font-size:20px;color:#4a90d9">👀 已扫码！</p>
      <p style="color:#666">请在手机上确认授权...</p>
      <script>setTimeout(()=>location.reload(), 2000)</script>`;
  } else if (loginStatus === "confirmed") {
    body = `<p style="font-size:24px;color:#27ae60">✅ 连接成功！</p>
      <p style="color:#666">蓝小梦已在线，去微信里找她聊天吧~</p>`;
  } else if (loginStatus === "failed") {
    body = `<p style="font-size:18px;color:#e74c3c">❌ ${loginMessage}</p>
      <p><a href="/" style="color:#4a90d9">重新开始</a></p>`;
  } else {
    body = `<p style="color:#888">准备就绪</p>
      <p><a href="/login" style="color:#4a90d9;font-size:16px;text-decoration:none;padding:10px 20px;border:2px solid #4a90d9;border-radius:8px">开始连接微信</a></p>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>蓝小梦 - 微信连接</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; }
  .card { background: #fff; border-radius: 16px; padding: 40px 30px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 380px; }
  h1 { margin: 0 0 5px; font-size: 22px; color: #333; }
  .subtitle { color: #999; font-size: 13px; margin-bottom: 20px; }
  .status { color: ${status.color}; font-weight: bold; }
</style></head>
<body><div class="card">
  <h1>🔮 ${CHARACTER}</h1>
  <p class="subtitle">微信 AI 伴侣 | 永劫无间·蓝梦</p>
  <p class="status">${status.icon} ${status.text}</p>
  ${body}
  ${botInstance ? '<p style="color:#27ae60;margin-top:20px">🟢 Bot 运行中</p>' : ''}
</div></body></html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/login" && loginStatus !== "waiting" && loginStatus !== "scanned") {
    // 触发登录
    res.writeHead(302, { Location: "/" });
    res.end();
    startLogin();
    return;
  }

  if (url.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: loginStatus,
      message: loginMessage,
      connected: !!botInstance,
      proactive: proactiveEnabled,
    }));
    return;
  }

  // 默认返回页面
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(getStatusPage());
});

function startHTTPServer() {
  server.listen(PORT, () => {
    console.log(`🌐 管理页面: http://localhost:${PORT}`);
    console.log(`   外网访问: http://<服务器IP>:${PORT}`);
  });
}

// ==================== 微信登录 (直接调 iLink API) ====================
async function fetchJSON(url, opts = {}) {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(opts.timeout || 15000),
    ...opts,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function startLogin() {
  loginStatus = "waiting";
  loginMessage = "";

  try {
    // Step 1: 获取二维码
    console.log("[登录] 获取二维码...");
    const qrResp = await fetchJSON(`${ILINK_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`);
    if (!qrResp.qrcode || !qrResp.qrcode_img_content) {
      loginStatus = "failed";
      loginMessage = qrResp.message || "获取二维码失败";
      console.error("[登录]", loginMessage);
      return;
    }

    qrCodeUrl = qrResp.qrcode_img_content;
    console.log("[登录] 二维码就绪");

    // Step 2: 轮询扫描状态
    let scannedLogged = false;
    let retries = 0;
    const maxRetries = 280; // ~8 min at 2s interval

    while (retries < maxRetries) {
      await sleep(2000);
      retries++;

      try {
        const statusResp = await fetchJSON(
          `${ILINK_BASE}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrResp.qrcode)}`,
          { timeout: 35000 }
        );

        switch (statusResp.status) {
          case "scaned":
            if (!scannedLogged) {
              loginStatus = "scanned";
              console.log("[登录] 已扫码");
              scannedLogged = true;
            }
            break;

          case "expired":
            // 自动刷新二维码
            console.log("[登录] 二维码过期，刷新...");
            const refreshResp = await fetchJSON(`${ILINK_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`);
            qrCodeUrl = refreshResp.qrcode_img_content;
            qrResp.qrcode = refreshResp.qrcode;
            scannedLogged = false;
            loginStatus = "waiting";
            console.log("[登录] 新二维码就绪");
            break;

          case "confirmed":
            // 登录成功！
            console.log("[登录] 确认成功！");
            const token = statusResp.bot_token;
            accountId = statusResp.ilink_bot_id;
            const baseUrl = statusResp.baseurl || ILINK_BASE;
            const userId = statusResp.ilink_user_id;

            // 保存凭证（兼容 weixin-agent-sdk 格式）
            saveCredentials(accountId, token, baseUrl, userId);

            loginStatus = "confirmed";
            qrCodeUrl = null;

            // 启动 Bot
            await startBot(accountId, baseUrl, token, userId);
            return;

          case "scaned_but_redirect":
            // 重定向，但我们的轮询 URL 不变，继续
            break;

          default:
            // "wait" 或其他，继续轮询
            break;
        }
      } catch (pollErr) {
        // 轮询超时是正常的（长轮询 35s），继续
        if (pollErr.name === "TimeoutError" || pollErr.message?.includes("timeout")) {
          continue;
        }
        console.error("[登录] 轮询错误:", pollErr.message);
      }
    }

    loginStatus = "failed";
    loginMessage = "超时，请重新开始";
  } catch (err) {
    loginStatus = "failed";
    loginMessage = err.message;
    console.error("[登录]", err.message);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ==================== 凭证管理 ====================
function saveCredentials(accountId, token, baseUrl, userId) {
  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || "~", ".openclaw");
  const wxDir = path.join(stateDir, "openclaw-weixin");
  const accountsDir = path.join(wxDir, "accounts");
  fs.mkdirSync(accountsDir, { recursive: true });

  // 保存账户文件
  const accountFile = path.join(accountsDir, `${accountId.replace(/[@.]/g, "-")}.json`);
  fs.writeFileSync(accountFile, JSON.stringify({
    token,
    baseUrl: baseUrl || ILINK_BASE,
    userId: userId || "",
    savedAt: new Date().toISOString(),
  }, null, 2));

  // 保存索引
  fs.writeFileSync(path.join(wxDir, "accounts.json"), JSON.stringify([accountId], null, 2));

  console.log("[凭证] 已保存");
}

// ==================== 启动 Bot ====================
async function startBot(accountId, baseUrl, token, userId) {
  if (!sdk) {
    sdk = await import("weixin-agent-sdk");
  }

  const nickname = getUserNickname();

  const lanmengAgent = {
    async chat(req) {
      const uid = req.conversationId || userId || "wx-user";
      const text = (req.text || "").trim();

      resetActivityTimer();
      if (text) lastUserMsg = text;

      if (!text) return { text: `${nickname}？你发了啥我怎么没看到~` };

      if (text === "/echo") return { text: "收到啦~ 蓝小梦在线中！" };
      if (text === "/ping") {
        const s = proactiveEnabled ? "开着呢~" : "关着呢，发 /wake 打开";
        return { text: `pong~ 活着呢老板！自动聊天${s}` };
      }
      if (text === "/sleep") {
        proactiveEnabled = false;
        return { text: "好嘞~ 我先睡啦💤" };
      }
      if (text === "/wake") {
        proactiveEnabled = true;
        resetActivityTimer();
        return { text: "芜湖~ 睡醒了！5分钟不理我我就来找你~" };
      }

      try {
        const reply = await handleMessage(uid, text);
        return { text: reply };
      } catch (err) {
        console.error("[蓝小梦]", err.message);
        return { text: "哎呀出了点岔子…老板你等下我变个戏法修一下~🎪" };
      }
    },
  };

  botInstance = sdk.start(lanmengAgent, { accountId });

  console.log(`✅ Bot 已启动 (accountId=${accountId})`);

  // 主动消息定时器
  proactiveTimer = setInterval(async () => {
    if (!botInstance || !proactiveEnabled) return;
    const elapsed = Date.now() - lastActivityTime;
    if (elapsed < INACTIVE_MS) return;

    try {
      const facts = getFacts(userId || "wx-user");
      const msg = generateProactiveMessage(lastUserMsg, facts);
      await botInstance.sendMessage(msg);
      console.log("[自动消息]", msg.slice(0, 40) + "...");
      resetActivityTimer();
    } catch {
      // context_token 问题，静默
    }
  }, 60_000);
}

function resetActivityTimer() {
  lastActivityTime = Date.now();
}

// ==================== 优雅退出 ====================
process.on("SIGINT", () => {
  console.log("");
  if (proactiveTimer) clearInterval(proactiveTimer);
  server.close();
  console.log(`${CHARACTER} > 拜拜了您内~`);
  process.exit(0);
});

// ==================== 启动 ====================
console.log("");
console.log(`╔══════════════════════════════════╗`);
console.log(`║  ${CHARACTER} — 微信桥接 v3 (服务器版) ║`);
console.log(`╚══════════════════════════════════╝`);
console.log("");

// 检查 API Key
if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("your-key")) {
  console.log("❌ 请先配置 DEEPSEEK_API_KEY");
  process.exit(1);
}

startHTTPServer();
console.log("");
console.log("📋 使用步骤:");
console.log(`  1. 打开浏览器访问 http://<服务器IP>:${PORT}`);
console.log("  2. 点击「开始连接微信」");
console.log("  3. 手机微信扫描页面上的二维码");
console.log("  4. 授权后自动连接，开始聊天！");
console.log("");
console.log("💡 微信聊天命令: /wake 开主动消息  /sleep 关主动消息  /ping 在线检测");
console.log("");

// 自动检查是否已登录
try {
  sdk = await import("weixin-agent-sdk");
  if (sdk.isLoggedIn()) {
    console.log("📱 检测到已有微信登录凭证，自动启动 Bot...");
    const ids = JSON.parse(fs.readFileSync(
      path.join(process.env.HOME || "~", ".openclaw", "openclaw-weixin", "accounts.json"),
      "utf-8"
    ));
    if (ids.length > 0) {
      accountId = ids[0];
      const accountFile = path.join(
        process.env.HOME || "~", ".openclaw", "openclaw-weixin", "accounts",
        `${accountId.replace(/[@.]/g, "-")}.json`
      );
      const account = JSON.parse(fs.readFileSync(accountFile, "utf-8"));
      await startBot(accountId, account.baseUrl, account.token, account.userId);
      loginStatus = "confirmed";
      console.log("✅ 自动启动成功！");
    }
  }
} catch {
  console.log("📱 未检测到登录凭证，请通过网页扫码登录");
}
