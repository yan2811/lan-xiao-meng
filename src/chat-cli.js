import "dotenv/config";
import readline from "node:readline";
import chalk from "chalk";
import { handleMessage } from "./agent.js";
import { getCharacterName, getUserNickname } from "./personality.js";

const userId = "cli-user";

console.log(chalk.cyan("╔══════════════════════════════════╗"));
console.log(chalk.cyan(`║     ${getCharacterName()} — 你的AI女友      ║`));
console.log(chalk.cyan("╚══════════════════════════════════╝"));
console.log("");
console.log(chalk.gray("  她叫你" + getUserNickname() + "~ 输入消息和她聊天吧"));
console.log(chalk.gray("  输入 /exit 退出，输入 /clear 清除记忆"));
console.log("");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.green("你 > "),
});

console.log(chalk.magenta(`${getCharacterName()} > `) + "老板~ 你终于来啦！今天有什么好吃的吗🥮？还是……又要让我干活？");

rl.prompt();

rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }

  if (input === "/exit" || input === "/quit") {
    console.log(chalk.magenta(`\n${getCharacterName()} > `) + "这就走啦？行吧行吧~ 记得带桂花糕回来！拜拜了您内~");
    rl.close();
    process.exit(0);
  }

  if (input === "/clear") {
    console.log(chalk.gray("（记忆已清除）"));
    rl.prompt();
    return;
  }

  process.stdout.write(chalk.magenta(`${getCharacterName()} > `));
  try {
    const reply = await handleMessage(userId, input);
    console.log(reply);
  } catch (err) {
    console.log(chalk.red(`（出错了：${err.message}）`));
  }
  console.log("");
  rl.prompt();
});

rl.on("close", () => {
  console.log(chalk.gray("\n会话结束~"));
  process.exit(0);
});
