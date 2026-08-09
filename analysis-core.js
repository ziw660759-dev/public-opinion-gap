(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GapCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GAP_TYPES = {
    unanswered: { label: '未回应温差', short: '未回应', description: '公众高频追问，但官方材料中没有直接可核验的回答。' },
    insufficient: { label: '解释不足温差', short: '解释不足', description: '官方触及了议题，但只停留在结论、原则或局部事实，关键细节没有展开。' },
    priority: { label: '重点错位温差', short: '重点错位', description: '双方都谈到该议题，但官方强调程度显著低于公众关注权重。' },
    frame: { label: '认知错位温差', short: '认知错位', description: '官方与公众使用了不同解释框架，例如公众追问“为什么”，官方主要回答“怎么处罚”。' },
    aligned: { label: '基本对齐', short: '基本对齐', description: '公众关切已获得较直接、较充分的解释。' },
  };

  const TOPIC_RULES = [
    { name: '责任认定', label: '谁承担责任', frame: '责任', keywords: ['责任', '谁负责', '谁承担', '谁决定', '管理层', '问责', '主体', '负责人'], question: '责任主体是谁，分别承担什么责任？' },
    { name: '原因机制', label: '为什么会发生', frame: '原因', keywords: ['为什么', '原因', '怎么会', '为何', '怎么出现', '机制', '导致', '缘由'], question: '问题为什么发生，直接原因和管理原因分别是什么？' },
    { name: '事实经过', label: '事情到底怎么发生', frame: '事实', keywords: ['经过', '到底', '当时', '过程', '完整公布', '事实', '真相', '时间线'], question: '事件完整经过和关键时间线是什么？' },
    { name: '赔偿救济', label: '损失如何补偿', frame: '救济', keywords: ['赔偿', '补偿', '退钱', '退款', '押金', '损失', '救济', '承担费用'], question: '受影响主体如何获得赔偿、补偿或其他救济？' },
    { name: '处罚问责', label: '相关人员如何处理', frame: '处置', keywords: ['处罚', '罚款', '处理', '停职', '处分', '违法成本', '立案', '行政处罚'], question: '涉事人员或机构受到什么具体处理？' },
    { name: '程序合规', label: '程序是否合规', frame: '程序', keywords: ['审批', '同意', '告知', '签字', '手续', '合规', '规定', '允许', '程序'], question: '相关程序是否合规，依据和具体要求是什么？' },
    { name: '后续整改', label: '如何防止再次发生', frame: '整改', keywords: ['整改', '以后', '后续', '保证', '防止', '监测', '检查', '加强', '复查'], question: '下一步如何整改，怎样防止同类问题再次发生？' },
    { name: '回应时效', label: '为什么没有及时回应', frame: '时效', keywords: ['及时回应', '迟迟', '一开始', '投诉', '回应', '沟通', '拖了', '反馈'], question: '前期为何未及时回应，后续沟通机制如何改进？' },
    { name: '现实影响', label: '实际影响如何解决', frame: '影响', keywords: ['身体', '健康', '睡不了', '影响', '安全', '生活', '老人', '孩子', '损害', '风险'], question: '事件对现实生活或权益造成了什么影响，如何解决？' },
  ];

  const OFFICIAL_FRAME_RULES = [
    { frame: '原因', keywords: ['原因', '因', '由于', '导致', '缘于', '主要原因'] },
    { frame: '责任', keywords: ['责任', '负责', '承担', '责任人', '管理责任', '问责'] },
    { frame: '事实', keywords: ['经查', '经调查', '核查', '事实', '经过', '时间', '当日', '现场'] },
    { frame: '救济', keywords: ['赔偿', '补偿', '退款', '退还', '协商', '救济', '支付'] },
    { frame: '处置', keywords: ['处罚', '罚款', '停职', '处分', '立案', '处理', '责令'] },
    { frame: '程序', keywords: ['审批', '告知', '签字', '程序', '手续', '依法', '规定'] },
    { frame: '整改', keywords: ['整改', '复查', '加强', '防止', '监测', '检查', '完善机制'] },
    { frame: '时效', keywords: ['回应', '反馈', '沟通', '第一时间', '及时', '接诉'] },
    { frame: '影响', keywords: ['影响', '健康', '生活', '安全', '损害', '风险'] },
  ];

  function clamp(n, min = 0, max = 100) { return Math.min(max, Math.max(min, n)); }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function normalize(text = '') { return String(text).replace(/[，。！？；：、“”‘’（）()\s,.!?;:\-—]/g, '').toLowerCase(); }

  function splitUnits(text = '') {
    return String(text)
      .split(/\n+|(?<=[。！？；])/) 
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);
  }

  function parsePublicUnits(text = '') {
    const raw = String(text).split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const lines = raw.length > 1 ? raw : splitUnits(text);
    return lines.map((line) => {
      let content = line;
      let interactions = 0;
      const prefix = content.match(/^\s*(\d{1,9})\s*(?:\||｜|::|：:)\s*(.+)$/);
      const suffix = content.match(/^(.+?)\s*(?:\||｜|::|：:)\s*(\d{1,9})\s*$/);
      if (prefix) { interactions = Number(prefix[1]); content = prefix[2].trim(); }
      else if (suffix) { content = suffix[1].trim(); interactions = Number(suffix[2]); }
      return { text: content, interactions };
    }).filter((x) => x.text.length >= 4);
  }

  function bigrams(text) {
    const n = normalize(text);
    const set = new Set();
    for (let i = 0; i < n.length - 1; i += 1) set.add(n.slice(i, i + 2));
    return set;
  }

  function jaccard(a, b) {
    const A = bigrams(a); const B = bigrams(b);
    if (!A.size || !B.size) return 0;
    let inter = 0; A.forEach((x) => { if (B.has(x)) inter += 1; });
    return inter / (A.size + B.size - inter);
  }

  function keywordScore(text, keywords) {
    if (!keywords || !keywords.length) return 0;
    const hit = keywords.filter((k) => String(text).includes(k)).length;
    if (!hit) return 0;
    return clamp(0.58 + (hit - 1) * 0.21, 0, 1);
  }

  function sharedAnchorScore(a, b) {
    const anchors = [...new Set(TOPIC_RULES.flatMap((rule) => rule.keywords))];
    const shared = anchors.filter((k) => String(a).includes(k) && String(b).includes(k)).length;
    if (!shared) return 0;
    return clamp(0.58 + (shared - 1) * 0.2, 0, 1);
  }

  function detectRule(text) {
    const ranked = TOPIC_RULES
      .map((rule) => ({ rule, score: keywordScore(text, rule.keywords) }))
      .sort((a, b) => b.score - a.score);
    return ranked[0] && ranked[0].score > 0
      ? ranked[0].rule
      : { name: '其他关切', label: '其他高频关切', frame: '其他', keywords: [], question: '这一高频关切需要官方补充哪些可核验信息？' };
  }

  function detectOfficialFrame(text) {
    const ranked = OFFICIAL_FRAME_RULES
      .map((r) => ({ frame: r.frame, score: keywordScore(text, r.keywords) }))
      .sort((a, b) => b.score - a.score);
    return ranked[0] && ranked[0].score > 0 ? ranked[0].frame : '事实';
  }

  function groupConcerns(items) {
    const map = new Map();
    items.forEach((item) => {
      const rule = detectRule(item.text);
      const key = rule.name === '其他关切' ? `其他关切:${normalize(item.text).slice(0, 8)}` : rule.name;
      const current = map.get(key) || { rule, items: [] };
      current.items.push(item);
      map.set(key, current);
    });
    return [...map.values()];
  }

  function itemWeight(item) {
    return 1 + Math.log10(1 + Math.max(0, item.interactions || 0)) * 0.65;
  }

  function bestOfficialMatch(publicItems, officialUnits, rule) {
    let best = { unit: '', score: 0, frame: '事实', topicScore: 0, semanticScore: 0 };
    officialUnits.forEach((official) => publicItems.forEach((pub) => {
      const semantic = jaccard(pub.text, official);
      const topic = rule.keywords.length ? keywordScore(official, rule.keywords) : 0;
      const anchor = sharedAnchorScore(pub.text, official);
      const labelSemantic = jaccard(rule.label, official);
      const score = clamp(semantic * 0.28 + topic * 0.31 + anchor * 0.34 + labelSemantic * 0.07, 0, 1);
      if (score > best.score) best = { unit: official, score, frame: detectOfficialFrame(official), topicScore: topic, semanticScore: semantic };
    }));
    return best;
  }

  function officialTopicShare(officialUnits, rule) {
    if (!officialUnits.length || !rule.keywords.length) return 0;
    const weighted = officialUnits.reduce((sum, unit) => sum + keywordScore(unit, rule.keywords), 0);
    return clamp(weighted / officialUnits.length, 0, 1);
  }

  function intensityScore(items) {
    if (!items.length) return 0;
    const signals = items.reduce((sum, item) => {
      const t = item.text;
      const punct = (t.match(/[？！?!]/g) || []).length;
      const challenge = /(到底|根本|一直|为什么|为何|谁|怎么|凭什么|必须|难道|究竟)/.test(t) ? 1 : 0;
      return sum + clamp((punct > 0 ? 0.45 : 0) + challenge * 0.55, 0, 1);
    }, 0);
    return signals / items.length;
  }

  function classifyGapType({ coverage, attention, priorityGap, publicFrame, officialFrame }) {
    if (coverage < 22) return 'unanswered';
    const frameMismatch = publicFrame !== '其他' && officialFrame && publicFrame !== officialFrame;
    if (frameMismatch && coverage < 70) return 'frame';
    if (priorityGap >= 18 && attention >= 55) return 'priority';
    if (coverage < 72) return 'insufficient';
    return 'aligned';
  }

  function levelFromGap(gap) {
    if (gap >= 70) return '极高温差';
    if (gap >= 45) return '高温差';
    if (gap >= 20) return '中温差';
    return '低温差';
  }

  function statusFromCoverage(coverage) {
    if (coverage >= 72) return '充分回应';
    if (coverage >= 22) return '部分回应';
    return '未回应';
  }

  function makeExplanation(topic, data) {
    const type = GAP_TYPES[data.primaryGapType];
    if (data.primaryGapType === 'unanswered') return `公众对“${topic}”有明确追问，但官方材料中尚未识别到直接回答，属于${type.label}。`;
    if (data.primaryGapType === 'frame') return `官方虽触及“${topic}”相关内容，但主要采用“${data.officialFrame}”框架，公众实际追问的是“${data.publicFrame}”，属于${type.label}。`;
    if (data.primaryGapType === 'priority') return `官方与公众都涉及“${topic}”，但公众关注权重高于官方解释权重 ${Math.round(data.priorityGap)} 个百分点，属于${type.label}。`;
    if (data.primaryGapType === 'insufficient') return `官方已经回应“${topic}”，但覆盖度仅为 ${data.coverage}%，仍缺少能够闭合公众疑问的关键事实或细节。`;
    return `“${topic}”已获得较直接解释，当前不是主要信息缺口。`;
  }

  function makeAdvice(rule, type) {
    const lead = {
      unanswered: '直接补答，不要以其他处置结果替代回答。',
      insufficient: '在已有结论基础上补足主体、原因、时间、依据或结果。',
      priority: '提高该议题在回应中的篇幅和显著性，避免重要信息埋在次要位置。',
      frame: '切换到公众正在使用的问题框架，先回答其核心疑问，再说明处置。',
      aligned: '维持信息一致，并在后续进展变化时及时更新。',
    }[type];
    return `${lead} 建议明确回答：“${rule.question}”`;
  }

  function analyze(input) {
    const officialUnits = splitUnits(input.officialText || '');
    const publicItems = parsePublicUnits(input.publicText || '');
    const groups = groupConcerns(publicItems);
    const groupWeights = groups.map((g) => g.items.reduce((sum, item) => sum + itemWeight(item), 0));
    const totalPublicWeight = groupWeights.reduce((a, b) => a + b, 0) || 1;
    const maxGroupWeight = Math.max(1, ...groupWeights);

    const topics = groups.map((group, index) => {
      const groupWeight = groupWeights[index];
      const publicShare = groupWeight / totalPublicWeight;
      const frequency = groupWeight / maxGroupWeight;
      const intensity = intensityScore(group.items);
      const attention = Math.round(clamp(35 + frequency * 52 + intensity * 13));
      const match = bestOfficialMatch(group.items, officialUnits, group.rule);
      const coverage = Math.round(clamp(match.score * 126));
      const officialShare = officialTopicShare(officialUnits, group.rule);
      const priorityGap = clamp((publicShare - officialShare) * 100);
      const primaryGapType = classifyGapType({
        coverage,
        attention,
        priorityGap,
        publicFrame: group.rule.frame,
        officialFrame: match.unit ? match.frame : null,
      });
      const framePenalty = primaryGapType === 'frame' ? 10 : 0;
      const priorityPenalty = primaryGapType === 'priority' ? priorityGap * 0.18 : 0;
      const gap = Math.round(clamp(attention * (1 - coverage / 100) + framePenalty + priorityPenalty));
      const concern = group.rule.label === '其他高频关切' ? group.items[0].text : group.rule.label;
      const data = {
        id: `${group.rule.name}-${index}`,
        topic: group.rule.name,
        publicConcern: concern,
        publicEvidence: group.items.slice(0, 4).map((x) => ({ text: x.text, interactions: x.interactions || 0 })),
        officialEvidence: match.unit ? [match.unit] : [],
        attention,
        coverage,
        gap,
        publicShare: Math.round(publicShare * 100),
        officialShare: Math.round(officialShare * 100),
        priorityGap: Math.round(priorityGap),
        publicFrame: group.rule.frame,
        officialFrame: match.unit ? match.frame : '无',
        primaryGapType,
        gapTypeLabel: GAP_TYPES[primaryGapType].label,
        level: levelFromGap(gap),
        status: statusFromCoverage(coverage),
        responseQuestion: group.rule.question,
      };
      data.explanation = makeExplanation(concern, data);
      data.responseAdvice = makeAdvice(group.rule, primaryGapType);
      return data;
    }).sort((a, b) => b.gap - a.gap);

    const weightSum = topics.reduce((sum, t) => sum + t.attention, 0) || 1;
    const alignmentRate = Math.round(topics.reduce((sum, t) => sum + t.attention * t.coverage, 0) / weightSum);
    const addressedRate = Math.round((topics.filter((t) => t.status !== '未回应').length / Math.max(1, topics.length)) * 100);
    const overallGap = topics.length
      ? Math.round(topics.reduce((sum, t) => sum + t.gap * (t.attention / 100), 0) / topics.reduce((sum, t) => sum + (t.attention / 100), 0))
      : 0;

    const officialFocus = officialUnits
      .map((unit) => ({ unit, rule: detectRule(unit) }))
      .filter((x) => x.rule.name !== '其他关切')
      .slice(0, 5)
      .map((x) => ({ topic: x.rule.name, text: x.unit.replace(/[。！？；]$/, '') }));

    const publicFocus = [...topics]
      .sort((a, b) => b.attention - a.attention)
      .slice(0, 5)
      .map((t) => ({ topic: t.topic, concern: t.publicConcern, attention: t.attention }));

    const gapTypeCounts = Object.keys(GAP_TYPES).reduce((acc, key) => {
      acc[key] = topics.filter((t) => t.primaryGapType === key).length;
      return acc;
    }, {});

    const topActionable = topics.filter((t) => t.primaryGapType !== 'aligned').slice(0, 3);
    const responseBrief = topActionable.map((t, i) => ({
      rank: i + 1,
      question: t.responseQuestion,
      reason: `${t.gapTypeLabel} · 关注度 ${t.attention} · 覆盖度 ${t.coverage}%`,
      advice: t.responseAdvice,
    }));

    const top = topics[0];
    const typeSummary = Object.entries(gapTypeCounts)
      .filter(([key, count]) => key !== 'aligned' && count > 0)
      .map(([key, count]) => `${GAP_TYPES[key].short}${count}项`)
      .join('、');
    const summary = top
      ? `当前官方解释与公众关切的对齐度为 ${alignmentRate}%。最大温差集中在“${top.publicConcern}”（${top.gapTypeLabel}，温差 ${top.gap}）。${typeSummary ? `本次共识别${typeSummary}。` : ''}下一轮回应应优先补足高关注、低覆盖或解释框架错位的问题。`
      : '当前材料不足以形成有效议题对齐，请补充官方回应与公众讨论。';

    return {
      version: '2.0',
      mode: 'local',
      title: input.title || '未命名舆情事件',
      overallGap,
      alignmentRate,
      addressedRate,
      topics,
      summary,
      officialFocus,
      publicFocus,
      gapTypeCounts,
      responseBrief,
      generatedAt: new Date().toISOString(),
    };
  }

  function normalizeAiResult(raw, fallbackTitle = '未命名舆情事件') {
    const source = raw && raw.result ? raw.result : raw;
    if (!source || !Array.isArray(source.topics)) throw new Error('AI 返回结果缺少 topics。');
    const topics = source.topics.map((t, index) => {
      const type = GAP_TYPES[t.primaryGapType] ? t.primaryGapType : 'insufficient';
      const attention = Math.round(clamp(Number(t.attention) || 0));
      const coverage = Math.round(clamp(Number(t.coverage) || 0));
      const gap = Math.round(clamp(Number(t.gap) || attention * (1 - coverage / 100)));
      return {
        id: t.id || `ai-${index}`,
        topic: t.topic || '其他关切',
        publicConcern: t.publicConcern || t.topic || '未命名关切',
        publicEvidence: (t.publicEvidence || []).map((x) => typeof x === 'string' ? { text: x, interactions: 0 } : x).slice(0, 4),
        officialEvidence: (t.officialEvidence || []).slice(0, 4),
        attention,
        coverage,
        gap,
        publicShare: Math.round(clamp(Number(t.publicShare) || 0)),
        officialShare: Math.round(clamp(Number(t.officialShare) || 0)),
        priorityGap: Math.round(clamp(Number(t.priorityGap) || 0)),
        publicFrame: t.publicFrame || '未标注',
        officialFrame: t.officialFrame || '未标注',
        primaryGapType: type,
        gapTypeLabel: GAP_TYPES[type].label,
        level: t.level || levelFromGap(gap),
        status: t.status || statusFromCoverage(coverage),
        explanation: t.explanation || GAP_TYPES[type].description,
        responseQuestion: t.responseQuestion || `请直接回应“${t.publicConcern || t.topic}”的核心疑问。`,
        responseAdvice: t.responseAdvice || GAP_TYPES[type].description,
      };
    }).sort((a, b) => b.gap - a.gap);

    const gapTypeCounts = Object.keys(GAP_TYPES).reduce((acc, key) => {
      acc[key] = topics.filter((t) => t.primaryGapType === key).length;
      return acc;
    }, {});
    const weightSum = topics.reduce((sum, t) => sum + t.attention, 0) || 1;
    const alignmentRate = Number.isFinite(Number(source.alignmentRate))
      ? Math.round(clamp(Number(source.alignmentRate)))
      : Math.round(topics.reduce((sum, t) => sum + t.attention * t.coverage, 0) / weightSum);
    const addressedRate = Number.isFinite(Number(source.addressedRate))
      ? Math.round(clamp(Number(source.addressedRate)))
      : Math.round(topics.filter((t) => t.status !== '未回应').length / Math.max(1, topics.length) * 100);
    const overallGap = Number.isFinite(Number(source.overallGap))
      ? Math.round(clamp(Number(source.overallGap)))
      : Math.round(topics.reduce((sum, t) => sum + t.gap, 0) / Math.max(1, topics.length));

    return {
      version: '2.0', mode: 'ai', title: source.title || fallbackTitle,
      overallGap, alignmentRate, addressedRate, topics,
      summary: source.summary || 'AI 已完成语义对齐分析。',
      officialFocus: source.officialFocus || [], publicFocus: source.publicFocus || [],
      gapTypeCounts,
      responseBrief: source.responseBrief || topics.filter((t) => t.primaryGapType !== 'aligned').slice(0, 3).map((t, i) => ({ rank: i + 1, question: t.responseQuestion, reason: `${t.gapTypeLabel} · 温差 ${t.gap}`, advice: t.responseAdvice })),
      generatedAt: source.generatedAt || new Date().toISOString(),
    };
  }

  return {
    GAP_TYPES,
    TOPIC_RULES,
    analyze,
    normalizeAiResult,
    splitUnits,
    parsePublicUnits,
    detectRule,
    detectOfficialFrame,
  };
});
