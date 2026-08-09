(function (root) {
  'use strict';

  async function analyzeWithAI(endpoint, input, options = {}) {
    const cleanEndpoint = String(endpoint || '').trim();
    if (!/^https?:\/\//.test(cleanEndpoint) && !cleanEndpoint.startsWith('/')) {
      throw new Error('请配置有效的 AI Gateway URL。');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 90000);
    try {
      const res = await fetch(cleanEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title || '',
          officialText: input.officialText || '',
          publicText: input.publicText || '',
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `AI Gateway 请求失败（${res.status}）`);
      return root.GapCore.normalizeAiResult(data, input.title);
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('AI 分析超时，请稍后重试或切换本地模式。');
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  root.GapAI = { analyzeWithAI };
})(typeof globalThis !== 'undefined' ? globalThis : this);
