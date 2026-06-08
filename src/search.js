// 联网搜索模块
// 使用 DuckDuckGo 免费 API，无需 API Key
// 自动检测需要搜索的场景：新闻、梗、事实性问题

const cache = new Map(); // key → { results, time }
const CACHE_TTL = 60 * 60 * 1000; // 缓存 1 小时
const SEARCH_TIMEOUT = 5000; // 搜索超时 5 秒

// 触发搜索的信号词/模式
const SEARCH_TRIGGERS = [
  // 直接请求搜索
  /(搜索|查一下|搜一下|帮我找|帮我查)/,
  // 事实性提问
  /(什么是|什么叫|是谁|是什么|什么梗|指的是|是什么梗)/,
  // 为什么提问
  /为什么.*(会|要|能|出现|发生|这样)/,
  // 新闻/时事
  /(今天|最近|最新).*(怎么样|发生了什么|有什么|新闻|消息|热点|瓜|八卦|大事)/,
  /(新闻|消息|热搜|热榜|头条|八卦|大瓜)/,
  // 天气/比分/股价等实时数据
  /(天气|温度|股价|汇率|比赛|比分|赛事|赢了|输了|夺冠)/,
  // 最近/有没有模式
  /(最近.*有什么|有没有.*(消息|新闻|新.*(梗|说法|玩法)))/,
  // 全球/国内大事
  /(全球|国内|世上|中国|美国|日本).*(大事|发生|情况)/,
];

export function shouldSearch(text) {
  if (!text || text.length < 4) return false;
  for (const pattern of SEARCH_TRIGGERS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function extractKeywords(text) {
  // 去掉语气词和废话，提取关键搜索词
  return text
    .replace(/[？?！!。.，,~～]+/g, " ")
    .replace(/(帮我|请|搜一下|查一下|搜索|什么是|什么叫|怎么样|为什么|是什么)/g, "")
    .trim()
    .slice(0, 120);
}

async function duckduckgoSearch(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=lan-xiao-meng`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT),
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  const results = [];

  // 摘要（Abstract）
  if (data.AbstractText && data.AbstractText.trim()) {
    results.push(data.AbstractText);
  }

  // 相关话题
  if (data.RelatedTopics && data.RelatedTopics.length > 0) {
    for (const topic of data.RelatedTopics.slice(0, 3)) {
      if (topic.Text && topic.Text.trim()) {
        results.push(topic.Text);
      }
    }
  }

  // 答案
  if (data.Answer && data.Answer.trim()) {
    results.push(data.Answer);
  }

  // 如果 DuckDuckGo 没结果，用备选
  if (results.length === 0) {
    return null;
  }

  return results.slice(0, 3).join(" | ");
}

// 备选搜索：DDG HTML 抓取
async function duckduckgoHTMLSearch(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT),
    });

    if (!resp.ok) return null;
    const html = await resp.text();

    // 简单提取 snippet
    const snippets = [];
    const matches = html.match(/class="result__snippet"[^>]*>(.*?)<\/a>/gs);
    if (matches) {
      for (const m of matches.slice(0, 3)) {
        const clean = m.replace(/<[^>]+>/g, "").trim();
        if (clean) snippets.push(clean);
      }
    }

    return snippets.length > 0 ? snippets.join(" | ") : null;
  } catch {
    return null;
  }
}

export async function searchWeb(query) {
  if (!query || query.length < 2) return null;

  const key = query.toLowerCase().trim();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.results;
  }

  let results = null;
  try {
    results = await duckduckgoSearch(query);
    if (!results) {
      results = await duckduckgoHTMLSearch(query);
    }
  } catch {
    // 搜索失败，静默返回
  }

  if (results) {
    cache.set(key, { results, time: Date.now() });
  }

  return results;
}

// 清理过期缓存（每隔一段时间调用）
export function cleanCache() {
  const now = Date.now();
  for (const [key, val] of cache) {
    if (now - val.time > CACHE_TTL * 2) {
      cache.delete(key);
    }
  }
}

// 定时清理
setInterval(cleanCache, 30 * 60 * 1000);
