/**
 * OpenAI 兼容 Chat Completions 客户端（板内 AI）。
 * 密钥与代理仅服务端使用；未配置 AI_API_KEY 时视为未启用。
 */

const DEFAULT_TIMEOUT_MS = 45_000;

export function isAiConfigured() {
  return Boolean(String(process.env.AI_API_KEY || '').trim());
}

export function getAiConfig() {
  const apiKey = String(process.env.AI_API_KEY || '').trim();
  const baseUrl = String(process.env.AI_BASE_URL || 'https://api.openai.com/v1')
    .trim()
    .replace(/\/$/, '');
  const model = String(process.env.AI_MODEL || 'gpt-4o-mini').trim();
  const proxy =
    String(process.env.AI_HTTP_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '').trim() ||
    null;
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  return { apiKey, baseUrl, model, proxy, timeoutMs };
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('模型返回为空');
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error('模型未返回合法 JSON');
  }
}

async function aiFetch(url, options = {}, proxy) {
  if (!proxy) return fetch(url, options);
  try {
    const undici = await import('undici');
    const dispatcher = new undici.ProxyAgent(proxy);
    const doFetch = undici.fetch || fetch;
    return doFetch(url, { ...options, dispatcher });
  } catch (err) {
    console.warn('[ai] 代理不可用，改为直连:', err?.message || err);
    return fetch(url, options);
  }
}

/**
 * @param {{ system: string, user: string, temperature?: number }} opts
 * @returns {Promise<string>} assistant content
 */
export async function chatCompletion({ system, user, temperature = 0.4 }) {
  if (!isAiConfigured()) {
    const err = new Error('未配置 AI_API_KEY，板内 AI 未启用');
    err.code = 'AI_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }

  const { apiKey, baseUrl, model, proxy, timeoutMs } = getAiConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await aiFetch(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: controller.signal,
      },
      proxy
    );

    const rawText = await res.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        `LLM 请求失败 (${res.status})`;
      const err = new Error(msg);
      err.code = 'AI_UPSTREAM';
      err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
      throw err;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      const err = new Error('模型未返回内容');
      err.code = 'AI_EMPTY';
      err.status = 502;
      throw err;
    }
    return String(content);
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error('AI 请求超时');
      timeoutErr.code = 'AI_TIMEOUT';
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function polishCardDescription({ title, description }) {
  const system = [
    '你是看板任务写作助手。根据用户给出的卡片标题与描述，输出更清晰、可执行的任务描述。',
    '要求：使用简体中文；保留原意；可用短段落或「- 」清单；不要编造用户未提到的关键事实。',
    '只返回 JSON：{"description":"..."}',
  ].join('');

  const user = JSON.stringify({
    title: String(title || '').trim(),
    description: String(description || '').trim(),
  });

  const content = await chatCompletion({ system, user, temperature: 0.3 });
  const parsed = extractJsonObject(content);
  const next = String(parsed?.description ?? '').trim();
  if (!next) {
    const err = new Error('润色结果为空');
    err.code = 'AI_BAD_OUTPUT';
    err.status = 502;
    throw err;
  }
  return { description: next };
}

/** 仅根据标题生成任务描述草稿（不写库） */
export async function generateCardDescription({ title }) {
  const cardTitle = String(title || '').trim();
  if (!cardTitle) {
    const err = new Error('卡片标题不能为空');
    err.code = 'AI_BAD_INPUT';
    err.status = 400;
    throw err;
  }

  const system = [
    '你是看板任务写作助手。用户只给了卡片标题，请据此生成一段可执行的任务描述。',
    '要求：简体中文；2～6 条要点或短段落；说明目标与验收要点；不要写成小说；不要编造具体人名/截止日期/未给出的技术细节。',
    '只返回 JSON：{"description":"..."}',
  ].join('');

  const user = JSON.stringify({ title: cardTitle });
  const content = await chatCompletion({ system, user, temperature: 0.35 });
  const parsed = extractJsonObject(content);
  const next = String(parsed?.description ?? '').trim();
  if (!next) {
    const err = new Error('生成描述为空');
    err.code = 'AI_BAD_OUTPUT';
    err.status = 502;
    throw err;
  }
  return { description: next };
}

export async function splitCardIntoTasks({ title, description }) {
  const system = [
    '你是看板任务拆分助手。把一张卡片拆成 3～8 张可独立执行的子任务。',
    '要求：简体中文；每张卡标题简短（≤40字）；描述一句话说明验收点；不要重复父卡标题本身。',
    '只返回 JSON：{"cards":[{"title":"...","description":"..."}]}',
  ].join('');

  const user = JSON.stringify({
    title: String(title || '').trim(),
    description: String(description || '').trim(),
  });

  const content = await chatCompletion({ system, user, temperature: 0.4 });
  const parsed = extractJsonObject(content);
  const list = Array.isArray(parsed?.cards) ? parsed.cards : [];
  const cards = list
    .map((c) => ({
      title: String(c?.title || '').trim(),
      description: String(c?.description || '').trim(),
    }))
    .filter((c) => c.title)
    .slice(0, 8);

  if (cards.length < 2) {
    const err = new Error('拆分结果过少，请补充卡片描述后再试');
    err.code = 'AI_BAD_OUTPUT';
    err.status = 502;
    throw err;
  }
  return { cards };
}

/** 拆成同一张卡片内的 checklist 条目（不写库） */
export async function splitCardIntoChecklist({ title, description }) {
  const system = [
    '你是看板任务清单助手。把一张卡片拆成 3～8 条可勾选的子步骤（同一张卡内的 checklist）。',
    '要求：简体中文；每条简短可执行（≤40字）；不要重复父卡标题；不要返回独立卡片。',
    '只返回 JSON：{"items":[{"text":"..."}]}',
  ].join('');

  const user = JSON.stringify({
    title: String(title || '').trim(),
    description: String(description || '').trim(),
  });

  const content = await chatCompletion({ system, user, temperature: 0.4 });
  const parsed = extractJsonObject(content);
  const list = Array.isArray(parsed?.items) ? parsed.items : [];
  const items = list
    .map((item) => ({
      text: String(item?.text || item?.title || '').trim(),
    }))
    .filter((item) => item.text)
    .slice(0, 8);

  if (items.length < 2) {
    const err = new Error('清单条目过少，请补充卡片描述后再试');
    err.code = 'AI_BAD_OUTPUT';
    err.status = 502;
    throw err;
  }
  return { items };
}

/** 根据标题与描述建议优先级（不写库） */
export async function suggestCardPriority({ title, description }) {
  const system = [
    '你是看板任务优先级助手。根据卡片标题与描述，判断优先级。',
    '只能返回 low、normal、high 三选一；high=紧急/阻塞/影响上线；low=可延后/琐事；其余为 normal。',
    '只返回 JSON：{"priority":"low|normal|high","reason":"一句中文理由"}',
  ].join('');

  const user = JSON.stringify({
    title: String(title || '').trim(),
    description: String(description || '').trim(),
  });

  const content = await chatCompletion({ system, user, temperature: 0.2 });
  const parsed = extractJsonObject(content);
  const priorityRaw = String(parsed?.priority || '').trim().toLowerCase();
  const priority =
    priorityRaw === 'low' || priorityRaw === 'high' || priorityRaw === 'normal'
      ? priorityRaw
      : 'normal';
  const reason = String(parsed?.reason || '').trim().slice(0, 120);
  return { priority, reason };
}

/**
 * 按自然语言指令，为某一列生成待添加的任务草稿（不写库）。
 */
export async function injectLaneTasks({ laneTitle, prompt, existingTitles = [] }) {
  const instruction = String(prompt || '').trim();
  if (!instruction) {
    const err = new Error('请输入要生成的任务说明');
    err.code = 'AI_BAD_INPUT';
    err.status = 400;
    throw err;
  }

  const system = [
    '你是看板列任务生成助手。根据用户指令，为指定列生成 3～8 张可独立执行的任务卡片。',
    '要求：简体中文；标题简短（≤40字）；描述一句话说明做什么/验收点；避免与已有卡片标题重复。',
    '只返回 JSON：{"cards":[{"title":"...","description":"..."}]}',
  ].join('');

  const user = JSON.stringify({
    laneTitle: String(laneTitle || '').trim() || '未命名列',
    prompt: instruction,
    existingTitles: (existingTitles || [])
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 40),
  });

  const content = await chatCompletion({ system, user, temperature: 0.45 });
  const parsed = extractJsonObject(content);
  const list = Array.isArray(parsed?.cards) ? parsed.cards : [];
  const cards = list
    .map((c) => ({
      title: String(c?.title || '').trim(),
      description: String(c?.description || '').trim(),
    }))
    .filter((c) => c.title)
    .slice(0, 8);

  if (cards.length < 1) {
    const err = new Error('未生成有效任务，请换个说法再试');
    err.code = 'AI_BAD_OUTPUT';
    err.status = 502;
    throw err;
  }
  return { cards };
}
