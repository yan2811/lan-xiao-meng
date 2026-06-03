# 蓝小梦 — AI 女友 Agent

基于《永劫无间》角色「**蓝梦**」设定的 AI 聊天 Agent。支持 **CLI 命令行聊天**和**微信扫码接入**两种模式。

> 蓝梦：彩戏师，20岁，慵懒机敏、爱摸鱼、满嘴俏皮话。最大心愿是消除强运命格，过上吃喝玩乐的平凡日子。

---

## ⚠️ 免责声明

- 本项目为**同人作品**，仅供学习交流使用，**禁止用于任何商业用途**
- 角色「蓝梦」版权归**网易（NetEase）**及《永劫无间》所有
- 本项目与网易及《永劫无间》官方**无任何关联**
- 项目中的角色台词和设定来源于游戏公开内容，属于同人创作范畴
- 本项目不提供任何游戏版权素材（头像、立绘等），请自行获取
- 使用微信桥接功能请遵守腾讯微信用户协议
- 开发者不对因使用本项目产生的任何后果承担责任

---

## 快速开始

### 1. 环境要求

- **Node.js >= 18** + **Windows 编译工具**（`npm install --global windows-build-tools` 或 Visual Studio Build Tools）
- **DeepSeek API Key**（在 [platform.deepseek.com](https://platform.deepseek.com) 获取）
- Windows / macOS / Linux 均可

### 2. 安装

```bash
cd "C:\Users\15279\Desktop\蓝小梦"

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
```

然后编辑 `.env` 文件，填入你的 API Key：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

### 3. 启动 CLI 聊天

```bash
npm run chat
```

启动后看到：

```
╔══════════════════════════════════╗
║     蓝梦 — 你的AI女友            ║
╚══════════════════════════════════╝

  她叫你老板~ 输入消息和她聊天吧
  输入 /exit 退出，输入 /clear 清除记忆

蓝梦 > 老板~ 你终于来啦！今天有什么好吃的吗？还是……又要让我干活？🥮
你 > 
```

---

## 项目结构

```
蓝小梦/
├── README.md                   # 本文件
├── package.json                # 项目配置
├── .env                        # 环境变量（API Key等）
├── .env.example                # 环境变量模板
├── config/
│   └── lanmeng-profile.json    # ★ 蓝梦人设配置文件
├── src/
│   ├── index.js                # 入口
│   ├── personality.js          # 人设注入（读取 profile → System Prompt）
│   ├── agent.js                # 核心 Agent（对话处理 + 自动记忆）
│   ├── memory.js               # 记忆系统（SQLite 存储）
│   ├── ai-client.js            # DeepSeek API 客户端（OpenAI 兼容）
│   ├── chat-cli.js             # CLI 聊天界面
│   └── wechat-bridge.js        # 微信桥接（可选）
└── data/
    └── memory/                 # 对话记忆数据库
        └── memory.db
```

---

## 自定义人设

编辑 `config/lanmeng-profile.json` 可以调整蓝梦的性格、说话风格、对你的称呼等。

### 关键配置项

| 配置路径 | 说明 | 示例 |
|---------|------|------|
| `personality.core` | 核心性格描述 | "慵懒随性、机敏狡黠" |
| `personality.speaking_style.tone` | 语气 | "口语化、俏皮、带点天津味儿" |
| `personality.speaking_style.catchphrases` | 口头禅列表 | "吃了吗老板~" |
| `personality.emotional_modes` | 情绪模式切换规则 | 撒娇/傲娇/慵懒/吐槽 |
| `relationship.user_nickname` | 对你的默认称呼 | "老板" |
| `relationship.user_alt_nicknames` | 亲昵时的称呼 | ["宝贝", "亲爱的"] |
| `behaviors.topics_of_interest` | 她感兴趣的话题 | 美食、偷懒、江湖趣闻 |
| `behaviors.avoid_topics` | 她会回避的话题 | 工作、KPI |

### 如果你想改成其他角色

直接修改 `lanmeng-profile.json` 中的内容即可。System Prompt 会自动根据配置文件生成。不需要改代码。

---

## 微信接入（扫码即用）

这是最爽的方式——一条命令出二维码，手机微信扫一下就接上了。之后你在微信里跟蓝小梦聊天，跟普通聊天一模一样。

### 前置条件

| 条件 | 怎么检查 |
|------|---------|
| **微信 iOS 版**（安卓暂未开放） | 微信 → 我 → 设置 → 插件 |
| **ClawBot 插件已开通** | 插件列表里能看到「微信 ClawBot」 |
| **Node.js >= 18** | `node -v` |

> ⚠️ **重要**：ClawBot 是腾讯 2026 年推出的官方插件，目前还在**灰度放量**阶段。不是所有用户都有。  
> 如果你在「微信 → 我 → 设置 → 插件」里看不到 ClawBot，说明还没灰度到你，只能等。

### 操作步骤（3 步）

```bash
# 第一步：安装微信桥接依赖
npm install weixin-agent-sdk

# 第二步：启动桥接
npm run wechat

# 第三步：终端会出现二维码，微信扫码 → 授权 → 完成！
```

扫码后的效果：

```
╔══════════════════════════════════╗
║   蓝梦 — 微信桥接模式            ║
╚══════════════════════════════════╝

📱 正在生成二维码...

   >>> 请用手机微信扫描终端里出现的二维码 <<<
   >>> 扫描后在微信里点击授权即可绑定 <<<

    [二维码图案]

✅ 蓝梦 已接入微信！
   现在在微信里找 ClawBot 对话框，叫她"老板"试试吧~
```

之后你就可以在手机微信里直接和蓝小梦聊天了。

### 微信里的聊天命令

| 命令 | 作用 |
|------|------|
| `/ping` | 检查蓝小梦是否在线 |
| `/echo` | 测试消息延迟 |

### 工作原理

```
你的微信(iOS) 
    ↕ ClawBot 插件
腾讯 iLink 服务器（长轮询）
    ↕ weixin-agent-sdk
蓝小梦 Agent
    ↕ DeepSeek API（带蓝梦人设 System Prompt）
回复 → 微信显示
```

### 如果没有 ClawBot 插件

先用 CLI 模式体验，效果和微信里一模一样，只是终端里聊：

```bash
npm run chat
```

等微信灰度到你，随时可以切过去。

---

## API 使用说明

如果你想把蓝梦 Agent 集成到自己的应用中：

```javascript
import { handleMessage } from "./src/agent.js";

// userId: 用户唯一标识（如微信号/用户ID）
// message: 用户发的文本
const reply = await handleMessage("user-123", "今天好累啊老板");

console.log(reply);
// → "哎哟老板~累了就歇着呗！刀不磨要生锈，人不睡觉要落后~ 
//    要不要我给你变个戏法解解闷？🥮"
```

Agent 会自动：
- 保存对话历史到 SQLite
- 提取并记住用户信息（名字、喜好等）
- 将记忆注入到后续对话的 System Prompt 中

---

## 技术架构

```
用户输入
   ↓
agent.js（调度中心）
   ├── memory.js        ← 读取历史消息 + 用户记忆
   ├── personality.js   ← 构建蓝梦 System Prompt
   └── ai-client.js     ← 调用 DeepSeek API
   ↓
蓝梦的回复
   ↓
memory.js ← 保存对话 + 自动提取用户信息
```

### 模型选择

| 模型 | 说明 |
|------|------|
| `deepseek-chat` | DeepSeek-V3，**推荐**，日常聊天效果很好 |
| `deepseek-reasoner` | DeepSeek-R1，深度思考，较慢但回复更有深度 |

在 `.env` 中修改 `DEEPSEEK_MODEL` 即可切换。

如果用第三方 API 代理（中转站），改 `DEEPSEEK_BASE_URL` 即可。

---

## 常见问题

### Q: 提示 "请先设置 DEEPSEEK_API_KEY"

A: 你还没配置 API Key。编辑 `.env` 填入你的 DeepSeek Key。
Key 在 https://platform.deepseek.com/api_keys 获取。

### Q: 回复太慢怎么办？

A: 用 `deepseek-chat`（V3 模型）速度很快，日常聊天够用。`deepseek-reasoner`（R1）会更深思熟虑但更慢。

### Q: 记忆存在哪里？

A: 在 `data/memory/memory.db`，SQLite 数据库。删除此文件即可清除所有记忆。

### Q: 微信接入一直提示 "模块未找到"

A: 微信桥接需要额外安装 `weixin-agent-sdk`，见「微信接入」章节。
如果你没有微信 ClawBot 插件，先在 CLI 模式体验即可。

### Q: 蓝梦的回复不太像她怎么办？

A: 编辑 `config/lanmeng-profile.json` 调整人设。重点关注：
- `personality.speaking_style.catchphrases` 增加她常说的话
- `personality.core` 调整性格描述
- 如果回复太长/太正式，在 System Prompt 的「重要规则」部分加强约束

---

## 安全注意事项

1. **API Key 不要泄露**：`.env` 文件不要提交到 Git，不要发到微信里
2. **对话数据本地存储**：所有聊天记录在 `data/memory.db`，不会上传到任何第三方
3. **微信风控**：微信桥接使用第三方工具（非微信官方），**建议用小号测试**，主号有封号风险
4. **消息经腾讯服务器**：使用微信模式时消息会经过腾讯 iLink 服务器，不要发送密码、密钥等敏感信息
5. **成本控制**：DeepSeek API 按 token 计费，价格非常便宜。日常闲聊聊一整天也就几分钱

---

## 对话示例

```
你 > 今天好累啊
蓝梦 > 哎哟我懂~生活生活，生下来就是干活！
       不过老板你也别太拼了，刀不磨要生锈，人不睡觉要落后~
       来来来，我给你变个小戏法解解乏？🎪

你 > 你还会变戏法？
蓝梦 > 那可不！盖世神技~天下无双~走过路过~不要错过~
       我可是彩戏师出身，秘传千年的鱼龙曼衍了解一下？
       不过现在嘛……懒得动，改天再给你表演吧老板~😴

你 > 你一天到晚就知道偷懒
蓝梦 > 学而不思则罔，不思不学则爽！
       有几个靠认真工作发了财的？乾坤容我懒，就是老板你不容~
       好啦好啦，有什么事你说嘛🥮

你 > 你最喜欢吃什么
蓝梦 > 桂花糕！热乎的那种，咬一口甜到心里~
       怎么老板，你要给我带吗？那我可就不客气了！
       跟我蓝梦混，三天吃九顿！🌺
```

---

## 依赖说明

| 包 | 用途 |
|----|------|
| `openai` | OpenAI 兼容 SDK（DeepSeek 使用此格式） |
| `dotenv` | 读取 .env 环境变量 |
| `chalk` | CLI 彩色文字 |
| `better-sqlite3` | 本地 SQLite 数据库（记忆存储） |
| `weixin-agent-sdk` | 微信桥接（可选） |

---

## License

仅供个人学习娱乐使用，请勿用于商业用途。

蓝梦角色版权归《永劫无间》（网易）所有。
