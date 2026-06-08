import "dotenv/config";
import { handleMessage } from "./agent.js";
import { getCharacterName, getUserNickname } from "./personality.js";
import { generateProactiveMessage } from "./proactive.js";
import { getFacts } from "./memory.js";

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
    const userId = "wx-user";
    const facts = getFacts(userId);
    const msg = generateProactiveMessage(lastUserMsg, facts);
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

      // 重置计时器（收到消息即更新活跃时间）
      resetActivityTimer();
      if (text) lastUserMsg = text;

      // 空消息
      if (!text) {
        return { text: `${nickname}？你发了啥我怎么没看到~` };
      }

      // 调试命令
      if (text === "/echo") return { text: "收到啦~ 蓝小梦在线中！" };
      if (text === "/ping") {
        const status = proactiveEnabled ? "开着呢~" : "关着呢，发 /wake 打开";
        return { text: `pong~ 活着呢老板！自动聊天${status}` };
      }
      if (text === "/sleep") {
        proactiveEnabled = false;
        return { text: "好嘞~ 那我先睡了，老板需要我的时候再叫我哦💤" };
      }
      if (text === "/wake") {
        proactiveEnabled = true;
        resetActivityTimer();
        return { text: "芜湖~ 睡醒了！自动聊天已开启，5 分钟不理我我就来找你~" };
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
  console.log("   在微信 ClawBot 里跟她聊天吧~");
  console.log("");
  console.log("   💬 发 /wake 开启主动消息（5分钟无对话自动找你）");
  console.log("   😴 发 /sleep 关闭主动消息");
  console.log("   📡 /ping 检查在线  /echo 测试延迟");
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
