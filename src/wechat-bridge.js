import "dotenv/config";
import { handleMessage } from "./agent.js";
import { getCharacterName, getUserNickname } from "./personality.js";
import { generateProactiveMessage } from "./proactive.js";

// ============================================================
//  蓝小梦 微信桥接（v2）
//  - 二维码扫码接入
//  - 5 分钟无对话自动发消息
//  - 早晚定时问候
// ============================================================

const CHARACTER = getCharacterName();
const INACTIVE_MS = 5 * 60 * 1000; // 5 分钟

let botInstance = null;
let lastActivityTime = Date.now();
let lastUserMsg = "";
let proactiveTimer = null;
let proactiveEnabled = false; // 收到第一条消息后开启

function resetActivityTimer() {
  lastActivityTime = Date.now();
}

async function tryProactiveMessage() {
  if (!botInstance || !proactiveEnabled) return;

  const elapsed = Date.now() - lastActivityTime;
  if (elapsed < INACTIVE_MS) return;

  try {
    const msg = generateProactiveMessage(lastUserMsg);
    await botInstance.sendMessage(msg);
    console.log(`[蓝小梦] 自动消息已发送: ${msg.slice(0, 40)}...`);
    resetActivityTimer();
  } catch (err) {
    // context_token 过期或还没收到过消息时会报错，静默处理
    if (!err.message?.includes("context_token")) {
      console.error("[蓝小梦] 自动消息失败:", err.message);
    }
  }
}

async function startWechatBridge() {
  console.log("");
  console.log(`╔══════════════════════════════════╗`);
  console.log(`║   ${CHARACTER} — 微信桥接模式 v2    ║`);
  console.log(`╚══════════════════════════════════╝`);
  console.log("");

  // 检查 API Key
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("your-key")) {
    console.log("❌ 请先配置 DEEPSEEK_API_KEY");
    console.log("   编辑项目目录下的 .env 文件");
    process.exit(1);
  }

  // 加载 SDK
  let sdk;
  try {
    sdk = await import("weixin-agent-sdk");
  } catch {
    console.log("❌ 未安装 weixin-agent-sdk，请先运行：npm install weixin-agent-sdk");
    process.exit(1);
  }

  const { login, start } = sdk;
  const nickname = getUserNickname();

  // 蓝小梦 Agent
  const lanmengAgent = {
    async chat(req) {
      const userId = req.conversationId || "wx-user";
      const text = (req.text || "").trim();

      // 收到用户消息 → 开启主动消息 + 重置计时器
      if (!proactiveEnabled) {
        proactiveEnabled = true;
        console.log("[蓝小梦] 主动消息已开启（收到第一条用户消息）");
      }
      resetActivityTimer();
      if (text) lastUserMsg = text;

      // 空消息
      if (!text) {
        return { text: `${nickname}？你发了啥我怎么没看到~` };
      }

      // 调试命令
      if (text === "/echo") return { text: "收到啦~ 蓝小梦在线中！" };
      if (text === "/ping") return { text: "pong~ 活着呢，自动聊天功能已开启！" };
      if (text === "/sleep") {
        proactiveEnabled = false;
        return { text: "好嘞~ 那我先睡了，老板需要我的时候再叫我哦💤" };
      }
      if (text === "/wake") {
        proactiveEnabled = true;
        resetActivityTimer();
        return { text: "芜湖~ 睡醒了！老板我回来了！刚刚有没有想我~" };
      }

      // 核心回复
      try {
        const reply = await handleMessage(userId, text);
        return { text: reply };
      } catch (err) {
        console.error("[蓝小梦] 错误:", err.message);
        return { text: "哎呀，我这儿出了点岔子…老板你等下，我变个戏法修一下~🎪" };
      }
    },
  };

  // 扫码登录
  console.log("📱 正在生成二维码...");
  console.log("   >>> 请用手机微信扫描终端里出现的二维码 <<<");
  console.log("");

  try {
    await login();
  } catch (err) {
    console.log("❌ 登录失败:", err.message);
    console.log("   检查微信 → 我 → 设置 → 插件 → 是否有「ClawBot」");
    process.exit(1);
  }

  // 启动 Bot
  botInstance = start(lanmengAgent);

  console.log("");
  console.log(`✅ ${CHARACTER} 已接入微信！`);
  console.log("   现在在微信 ClawBot 里跟她聊天吧~");
  console.log("");
  console.log("   💬 5分钟无对话会自动发消息找你");
  console.log("   🌅 早晚时段有特别的问候语");
  console.log("   /ping 检查在线  /sleep 关主动消息  /wake 开主动消息");
  console.log("   Ctrl+C 停止");
  console.log("");

  // 启动主动消息定时器：每 60 秒检查一次
  proactiveTimer = setInterval(() => tryProactiveMessage(), 60_000);

  // Ctrl+C 退出
  process.on("SIGINT", async () => {
    console.log("");
    if (proactiveTimer) clearInterval(proactiveTimer);
    console.log(`${CHARACTER} > 这就走了？行吧行吧~ 记得带桂花糕回来！拜拜了您内~`);
    process.exit(0);
  });

  await botInstance.wait();
}

startWechatBridge();
