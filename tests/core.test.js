const assert = require('node:assert/strict');
const core = require('../analysis-core.js');

function testFourGapTypes() {
  const result = core.analyze({
    title: '四类温差测试',
    officialText: [
      '经调查，事件相关事实已经核实。',
      '有关部门已对涉事人员作出处理，但具体处理措施将在后续公布。',
      '关于补偿问题，已启动协商。',
      '项目审批手续符合规定。',
      '下一步将加强检查并落实整改。',
      '目前情况总体稳定。',
    ].join(''),
    publicText: [
      '500 | 为什么会发生这个问题？',
      '480 | 到底是什么原因导致的？',
      '450 | 谁应该承担管理责任？',
      '420 | 负责人到底是谁？',
      '350 | 具体怎么赔偿？',
      '330 | 补偿标准是什么？',
      '100 | 涉事人员最后怎么处罚？',
    ].join('\n'),
  });
  assert.equal(result.version, '2.0');
  assert.ok(result.topics.length >= 4);
  assert.ok(result.responseBrief.length <= 3);
  assert.ok(result.topics.every((t) => t.gap >= 0 && t.gap <= 100));
  assert.ok(result.topics.some((t) => t.primaryGapType === 'unanswered' || t.primaryGapType === 'frame'));
  assert.ok(result.topics.some((t) => t.primaryGapType === 'insufficient' || t.primaryGapType === 'priority'));
}

function testInteractionParsing() {
  const items = core.parsePublicUnits('286 | 第一条评论\n第二条评论 | 99\n普通评论');
  assert.equal(items.length, 3);
  assert.equal(items[0].interactions, 286);
  assert.equal(items[1].interactions, 99);
  assert.equal(items[2].interactions, 0);
}

function testAiNormalize() {
  const normalized = core.normalizeAiResult({
    title: 'AI结果', summary: '摘要', officialFocus: [], publicFocus: [],
    topics: [{
      id: '1', topic: '原因', publicConcern: '为什么发生', publicEvidence: ['为什么？'], officialEvidence: ['已处理。'],
      attention: 90, coverage: 20, gap: 80, publicShare: 60, officialShare: 10, priorityGap: 50,
      publicFrame: '原因', officialFrame: '处置', primaryGapType: 'frame', explanation: '框架错位',
      responseQuestion: '为什么发生？', responseAdvice: '补充原因。',
    }],
  });
  assert.equal(normalized.mode, 'ai');
  assert.equal(normalized.topics[0].gapTypeLabel, '认知错位温差');
  assert.equal(normalized.responseBrief.length, 1);
}

testFourGapTypes();
testInteractionParsing();
testAiNormalize();
console.log('✓ analysis-core V2 tests passed');
