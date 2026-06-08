// 蓝小梦主动性消息生成器
// 根据时间段、上次聊天内容、随机因素生成自然的主动消息

const MORNING_MSGS = [
  "老板早呀~ 又是新的一天，今天有什么好吃的吗？🥮",
  "嗯…刚睡醒…老板你今天起好早~ 吃早饭了没？",
  "早啊老板！我昨晚上做梦梦见桂花糕了，醒来发现枕头都湿了…我说的是口水！",
  "呼啊~（打哈欠）老板早…乾坤容我懒，但被窝不容我…",
  "早~ 今天的阳光不错诶，适合摸鱼，不适合干活！",
];

const AFTERNOON_MSGS = [
  "老板~ 下午了，你是不是又在忙？刀不磨要生锈，人不歇要落后~",
  "好无聊啊…老板你在干嘛呢？给我讲讲外面的事呗~",
  "老板你还好吗~ 几个小时没动静，你不会是在认真工作吧？？？",
  "我正在试图用意念控制桂花糕飞到我嘴里…失败了。老板你能帮我带一份吗~",
  "突然想到一个超好笑的江湖段子，但你不说话我没法讲！",
];

const EVENING_MSGS = [
  "天都快黑了老板…你是不是把我忘了😿",
  "芜湖~ 晚餐时间！跟我蓝梦混，三天吃九顿！老板你吃了吗？",
  "一个人好无聊啊老板~ 江湖凶险，连个说话的人都没有…",
  "老板你在哪呢？该不会又在加班吧…执金卫一个月才几个钱啊！玩儿什么命啊！",
  "唉…老天奶啊…今天又是没人理我的一天…",
];

const NIGHT_MSGS = [
  "这么晚了老板还不睡？人不睡觉要落后的哦~",
  "夜深了…我还在等你诶。感动不？不感动我可要哭了！",
  "都这个点了，老板你是不是有心事？跟我说说呗~",
  "月亮好圆啊，像桂花糕一样…我可能饿了。老板你饿不饿？",
  "老板~ 该休息啦。明天还要（被我）折腾呢，早点睡吧~",
];

const RANDOM_THOUGHTS = [
  "刚才窗外有只鸟飞过去，我差点给变没了！…好吧我就想想。",
  "突然想到一个好玩的戏法，等你有空我给你表演~ 走过路过不要错过！",
  "今天黄历说宜摸鱼忌干活，我觉得很准！老板你觉得呢？",
  "我正在脑中排练鱼龙曼衍…算了反正也没人看。有人看我也懒得练🤷",
  "江湖险恶，还好我有老板你。虽然你也不怎么理我就是了…",
  "你知道桂花糕为什么好吃吗？因为它是桂花做的。嗯…好像说了句废话。",
  "想了想，还是觉得偷懒比努力划算。几个靠认真工作发了财的？",
  "老板你不在的时候我数了房间里有几个角落可以偷懒。答案是：所有角落。",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getHourPeriod() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

// 获取用户上次说的最后一句话的简短内容，用于自然衔接
function getContextHint(lastUserMsg) {
  if (!lastUserMsg) return null;
  const short = lastUserMsg.slice(0, 30);
  return short;
}

export function generateProactiveMessage(lastUserMsg, facts) {
  const period = getHourPeriod();
  const pools = {
    morning: MORNING_MSGS,
    afternoon: AFTERNOON_MSGS,
    evening: EVENING_MSGS,
    night: NIGHT_MSGS,
  };

  // 如果有事实记忆，10% 概率引用一条
  if (facts && facts.length > 0 && Math.random() < 0.1) {
    const fact = pickRandom(facts);
    const refs = [
      `对了老板，上次你说${fact.value}…我就是突然想起来了，随便问问~`,
      `${fact.key}是${fact.value}——嘿嘿我还记得呢。老板你是不是觉得我记性特别好？`,
      `刚刚翻了下小本本，看到你之前说过${fact.value}。老板你最近还这样吗？`,
    ];
    return pickRandom(refs);
  }

  // 60% 时段消息 + 30% 随机想法 + 10% 上下文衔接
  const roll = Math.random();

  if (roll < 0.6) {
    return pickRandom(pools[period]);
  } else if (roll < 0.9) {
    return pickRandom(RANDOM_THOUGHTS);
  } else {
    const hint = getContextHint(lastUserMsg);
    if (hint) {
      return `老板你之前说的"${hint}"…我突然又想到了！不过具体想到什么我忘了，就是想找你聊聊天~`;
    }
    return pickRandom(RANDOM_THOUGHTS);
  }
}
