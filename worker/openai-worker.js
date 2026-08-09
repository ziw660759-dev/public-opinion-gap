/**
 * 舆情温差 V2 · OpenAI Gateway (Cloudflare Worker)
 *
 * Secrets / vars:
 *   OPENAI_API_KEY   required secret
 *   OPENAI_MODEL     optional, default: gpt-5.4-mini
 *   ALLOWED_ORIGIN   recommended, e.g. https://YOUR_NAME.github.io
 */

const GAP_TYPE_ENUM = ['unanswered', 'insufficient', 'priority', 'frame', 'aligned'];

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    topics: {
      type: 'array',
      minItems: 1,
      maxItems: 15,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          topic: { type: 'string' },
          publicConcern: { type: 'string' },
          publicEvidence: {
            type: 'array', maxItems: 4,
            items: {
              type: 'object', additionalProperties: false,
              properties: { text: { type: 'string' }, interactions: { type: 'number' } },
              required: ['text', 'interactions'],
            },
          },
          officialEvidence: { type: 'array', maxItems: 4, items: { type: 'string' } },
          attention: { type: 'number', minimum: 0, maximum: 100 },
          coverage: { type: 'number', minimum: 0, maximum: 100 },
          gap: { type: 'number', minimum: 0, maximum: 100 },
          publicShare: { type: 'number', minimum: 0, maximum: 100 },
          officialShare: { type: 'number', minimum: 0, maximum: 100 },
          priorityGap: { type: 'number', minimum: 0, maximum: 100 },
          publicFrame: { type: 'string' },
          officialFrame: { type: 'string' },
          primaryGapType: { type: 'string', enum: GAP_TYPE_ENUM },
          explanation: { type: 'string' },
          responseQuestion: { type: 'string' },
          responseAdvice: { type: 'string' },
        },
        required: [
          'id', 'topic', 'publicConcern', 'publicEvidence', 'officialEvidence',
          'attention', 'coverage', 'gap', 'publicShare', 'officialShare', 'priorityGap',
          'publicFrame', 'officialFrame', 'primaryGapType', 'explanation',
          'responseQuestion', 'responseAdvice',
        ],
      },
    },
    officialFocus: {
      type: 'array', maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        properties: { topic: { type: 'string' }, text: { type: 'string' } },
        required: ['topic', 'text'],
      },
    },
    publicFocus: {
      type: 'array', maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        properties: { topic: { type: 'string' }, concern: { type: 'string' }, attention: { type: 'number', minimum: 0, maximum: 100 } },
        required: ['topic', 'concern', 'attention'],
      },
    },
  },
  required: ['title', 'summary', 'topics', 'officialFocus', 'publicFocus'],
};

const SYSTEM_PROMPT = `你是“舆情温差”语义研判引擎。你的任务不是判断正负面情绪，而是比较同一舆情事件中“官方解释了什么”和“公众真正关心什么”，寻找解释缺口。

必须遵守以下定义：
1. 未回应温差 unanswered：公众存在明确、高频问题，但官方没有直接提供可核验回答。
2. 解释不足温差 insufficient：官方触及该问题，但只给结论、原则性表述或局部事实，关键主体、原因、时间、依据、结果等没有闭合。
3. 重点错位温差 priority：官方和公众都谈到同一问题，但公众关注权重明显高于官方解释权重，官方把高关注问题放在次要位置。
4. 认知错位温差 frame：官方与公众不是在回答同一个问题框架。例如公众问“为什么发生/谁负责/如何赔偿”，官方主要回答“已处罚/已整改/程序合规”。“提到了相关事情”不能视为“回答了问题”。
5. aligned：该公众关切已经获得直接、充分且问题框架一致的解释。

分析要求：
- 先从公众材料开放式聚类议题，不受固定标签限制；相近问法合并，明显不同的问题不要硬合并。
- 如公众评论采用“数字 | 评论”格式，数字代表互动量，应影响 attention 和 publicShare；未提供互动量时以频次、重复程度、追问强度综合判断。
- 从官方材料拆出独立解释点，并识别其回答框架（事实、原因、责任、程序、处置、救济、整改、时效、影响等）。
- coverage 表示“对公众原问题的直接解释覆盖度”，不是文本相似度。出现相关关键词但答非所问时 coverage 应保持较低。
- gap 的基础逻辑是 attention × (1 - coverage/100)，可在重点错位或认知错位时适度上调，但保持 0-100。
- publicEvidence 和 officialEvidence 必须尽量引用输入材料中的原句或短句，不得杜撰事实。
- responseQuestion 必须写成下一轮官方最需要直接回答的一个具体问题；responseAdvice 给出应补充的信息维度，不得捏造答案。
- summary 用 2-4 句概括最大温差、主要错位类型和下一轮回应优先级。
- 只基于用户提供材料研判，不补充外部事实。`;

function corsHeaders(origin, env) {
  const configured = env.ALLOWED_ORIGIN || '*';
  const allow = configured === '*' ? '*' : configured;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status, origin, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin, env) },
  });
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  for (const item of data.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '';
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin, env);

    if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== '*' && origin && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: 'Origin not allowed' }, 403, origin, env);
    }
    if (!env.OPENAI_API_KEY) return json({ error: 'Server missing OPENAI_API_KEY' }, 500, origin, env);

    let body;
    try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON body' }, 400, origin, env); }
    const title = String(body.title || '未命名舆情事件').slice(0, 200);
    const officialText = String(body.officialText || '').trim();
    const publicText = String(body.publicText || '').trim();
    if (!officialText || !publicText) return json({ error: 'officialText and publicText are required' }, 400, origin, env);
    if (officialText.length + publicText.length > 90000) return json({ error: 'Input is too long; please reduce the material size.' }, 413, origin, env);

    const input = `【事件名称】\n${title}\n\n【官方材料】\n${officialText}\n\n【公众讨论】\n${publicText}`;
    const model = env.OPENAI_MODEL || 'gpt-5.4-mini';

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instructions: SYSTEM_PROMPT,
          input,
          store: false,
          max_output_tokens: 10000,
          text: {
            format: {
              type: 'json_schema',
              name: 'public_opinion_gap_v2',
              schema: RESPONSE_SCHEMA,
              strict: true,
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error?.message || `OpenAI request failed (${response.status})`;
        return json({ error: message }, 502, origin, env);
      }

      const outputText = extractOutputText(data);
      if (!outputText) return json({ error: 'Model returned no structured output.' }, 502, origin, env);
      let result;
      try { result = JSON.parse(outputText); }
      catch (_) { return json({ error: 'Model output could not be parsed as JSON.' }, 502, origin, env); }

      return json({ result, meta: { model, responseId: data.id || null } }, 200, origin, env);
    } catch (err) {
      return json({ error: err?.message || 'Gateway request failed.' }, 500, origin, env);
    }
  },
};
