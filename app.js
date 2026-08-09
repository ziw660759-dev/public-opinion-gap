const { GAP_TYPES, analyze } = window.GapCore;

const DEMOS = [
  {
    id: 'medical', title: '社区医疗机构诊疗争议',
    officialText: '经调查，涉事医疗机构及医师在诊疗过程中存在未充分履行知情告知义务、病历记录不规范等问题。有关部门已依法对医疗机构和涉事医师作出行政处罚，并责令限期整改。关于患者后续诉求，相关单位正组织双方进一步沟通协商。',
    publicText: '286 | 为什么打针之前没有明确告诉患者副作用？\n412 | 是谁决定修改病历的，修改病历到底是谁的责任？\n197 | 医院管理层有没有责任，为什么会出现这种事情？\n368 | 患者身体受到影响以后到底怎么赔偿？\n95 | 医生最后受到了什么处罚？\n164 | 医院有没有完整公布当时诊疗经过？\n82 | 以后怎么保证别的患者不会遇到同样的问题？\n143 | 为什么患者一开始反映问题的时候没有及时回应？'
  },
  {
    id: 'housing', title: '住宅施工噪音投诉',
    officialText: '经核查，项目部分夜间施工作业已依法取得相关审批手续。针对未经审批超时施工的行为，执法部门已依法立案处罚，并要求施工单位加强现场管理，合理安排作业时间，减少对周边居民的影响。',
    publicText: '312 | 有审批就可以半夜一直施工吗？\n477 | 老人和孩子晚上根本睡不了，实际影响谁来解决？\n264 | 为什么连续投诉这么多次还在施工？\n133 | 所谓审批具体允许施工到几点？\n209 | 处罚之后有没有真的停下来？\n101 | 施工方被罚了多少钱？\n158 | 居民如果长期受影响有没有补偿方案？'
  },
  {
    id: 'rental', title: '出租屋发霉退租纠纷',
    officialText: '社区已组织房东与租客进行现场协商，双方就押金及剩余租金退还问题达成一致，相关款项已完成支付。目前双方纠纷已妥善解决。',
    publicText: '188 | 房子大面积发霉到底是什么原因？\n247 | 这种房子还能不能继续出租？\n129 | 租客家人身体不舒服有没有进一步检查？\n301 | 房东退钱了，但房屋安全问题谁负责？\n117 | 社区后续会不会检查这套房子？\n64 | 押金最后退了吗？\n93 | 为什么之前一直协商不下来？'
  }
];

const state = {
  page: 'overview', input: { ...DEMOS[0] }, result: null,
  mode: localStorage.getItem('gap-analysis-mode') || 'local',
  endpoint: localStorage.getItem('gap-ai-endpoint') || '', filter: 'all'
};
const app = document.querySelector('#app');
const overlay = document.querySelector('#overlayRoot');
const $ = (s) => document.querySelector(s);
const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const meta = k => GAP_TYPES[k] || GAP_TYPES.insufficient;

function badge(type){ return `<span class="tag tag-${type}">${esc(meta(type).short)}</span>`; }
function setModePill(){ const el=$('#modePill'); if(el){ el.textContent=state.mode==='ai'?'AI SEMANTIC':'LOCAL'; el.classList.toggle('ai',state.mode==='ai'); } }
function metric(label,value,help){ return `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${help}</small></div>`; }

function renderOverview(){
  const r = state.result || analyze(state.input); state.result=r; setModePill();
  const topics = state.filter==='all' ? r.topics : r.topics.filter(t=>t.primaryGapType===state.filter);
  const top=r.topics[0];
  app.innerHTML=`
  <section class="hero">
    <div><p class="eyebrow">PUBLIC OPINION GAP · V2</p><h1>${esc(r.title)}</h1>
    <p>对齐“官方解释了什么”和“公众真正追问什么”，定位没有被回答的部分。</p>
    <div class="actions"><button class="primary" id="newBtn">＋ 新建分析</button><button id="exportBtn">导出 JSON</button><button id="settingsInline">AI 设置</button></div></div>
    <div class="score"><span>综合舆情温差</span><strong>${r.overallGap}</strong><i><b style="width:${r.overallGap}%"></b></i><small>${top?esc(top.publicConcern):'暂无议题'}</small></div>
  </section>
  <section class="metrics">${metric('议题对齐度',r.alignmentRate+'%','公众关切被直接解释的程度')}${metric('回应覆盖率',r.addressedRate+'%','至少被官方触及的关切')}${metric('待补答问题',r.responseBrief.length,'下一轮优先回应')}</section>
  <section class="summary"><b>✦ 研判摘要</b><p>${esc(r.summary)}</p></section>
  <section class="types">${['unanswered','insufficient','priority','frame'].map(k=>`<button data-filter="${k}" class="${state.filter===k?'active':''}"><b>${meta(k).label}</b><strong>${r.gapTypeCounts?.[k]||0}</strong><small>${meta(k).description}</small></button>`).join('')}</section>
  <section class="layout">
    <div class="panel grow"><div class="head"><div><p class="eyebrow">GAP MATRIX</p><h2>舆情温差矩阵</h2></div><button data-filter="all">全部 ${r.topics.length}</button></div>
      <div class="matrix-head"><span>公众关切</span><span>类型</span><span>关注</span><span>覆盖</span><span>温差</span></div>
      <div>${topics.length?topics.map(t=>`<button class="row" data-topic="${esc(t.id)}"><span><b>${esc(t.publicConcern)}</b><small>${esc(t.topic)} · ${esc(t.status)}</small></span>${badge(t.primaryGapType)}<em>${t.attention}</em><em>${t.coverage}%</em><strong>${t.gap}</strong></button>`).join(''):'<p class="empty">当前筛选没有议题。</p>'}</div>
    </div>
    <div class="panel brief"><p class="eyebrow">NEXT RESPONSE</p><h2>下一轮最该回答</h2>${r.responseBrief.length?r.responseBrief.map(x=>`<div class="brief-item"><span>0${x.rank}</span><div><b>${esc(x.question)}</b><small>${esc(x.reason)}</small><p>${esc(x.advice)}</p></div></div>`).join(''):'<p class="empty">暂无明显待补答问题。</p>'}</div>
  </section>
  <section class="panel"><p class="eyebrow">ISSUE ALIGNMENT</p><h2>双方到底在谈什么</h2><div class="focus"><div><h3>官方解释重点</h3>${(r.officialFocus||[]).map((x,i)=>`<p><span>${i+1}</span>${esc(typeof x==='string'?x:`${x.topic}：${x.text}`)}</p>`).join('')||'<small>暂无</small>'}</div><div><h3>公众关注重点</h3>${(r.publicFocus||[]).map((x,i)=>`<p><span>${i+1}</span>${esc(typeof x==='string'?x:`${x.topic} · ${x.attention}：${x.concern}`)}</p>`).join('')||'<small>暂无</small>'}</div></div></section>`;

  $('#newBtn').onclick=()=>setPage('input'); $('#settingsInline').onclick=openSettings; $('#exportBtn').onclick=()=>download(r);
  document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>{state.filter=el.dataset.filter;renderOverview();});
  document.querySelectorAll('[data-topic]').forEach(el=>el.onclick=()=>openDrawer(r.topics.find(t=>t.id===el.dataset.topic)));
}

function renderInput(){ setModePill(); const i=state.input;
  app.innerHTML=`<section class="input-page"><p class="eyebrow">NEW ANALYSIS · V2</p><h1>官方解释与公众关切，差在哪里？</h1><p>公众评论建议一条一行；可用 <code>286 | 评论内容</code> 写入互动量。</p>
  <div class="mode-switch"><button data-mode="local" class="${state.mode==='local'?'active':''}"><b>本地可解释模式</b><small>零上传、无需 API</small></button><button data-mode="ai" class="${state.mode==='ai'?'active':''}"><b>AI 语义模式</b><small>${state.endpoint?'Gateway 已配置':'需配置 Gateway'}</small></button></div>
  <div class="demo">${DEMOS.map(d=>`<button data-demo="${d.id}">${esc(d.title)}</button>`).join('')}</div>
  <div class="form"><label>事件名称<input id="titleInput" value="${esc(i.title)}"></label><div class="two"><label>官方回应<textarea id="officialInput" rows="15">${esc(i.officialText)}</textarea></label><label>公众讨论<textarea id="publicInput" rows="15">${esc(i.publicText)}</textarea></label></div><div class="form-foot"><small>${state.mode==='ai'?'材料会发送到你配置的 AI Gateway。':'所有分析在浏览器本地完成。'}</small><button class="primary" id="runBtn">${state.mode==='ai'?'开始 AI 分析':'开始本地分析'} →</button></div></div></section>`;
  document.querySelectorAll('[data-demo]').forEach(el=>el.onclick=()=>{state.input={...DEMOS.find(d=>d.id===el.dataset.demo)};renderInput();});
  document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>{state.mode=el.dataset.mode;localStorage.setItem('gap-analysis-mode',state.mode);renderInput();});
  $('#runBtn').onclick=runAnalysis;
}

async function runAnalysis(){
  state.input={title:$('#titleInput').value.trim(),officialText:$('#officialInput').value.trim(),publicText:$('#publicInput').value.trim()};
  if(!state.input.officialText||!state.input.publicText){toast('请同时输入官方回应和公众讨论。',true);return;}
  if(state.mode==='ai'&&!state.endpoint){openSettings();return;}
  const btn=$('#runBtn'); btn.disabled=true; btn.textContent='分析中…';
  try{ state.result=state.mode==='ai'?await window.GapAI.analyzeWithAI(state.endpoint,state.input):analyze(state.input);state.filter='all';setPage('overview'); }
  catch(e){toast(e.message||'分析失败',true);btn.disabled=false;btn.textContent='重新分析';}
}

function openDrawer(t){ if(!t)return; const pubs=(t.publicEvidence||[]).map(x=>typeof x==='string'?{text:x,interactions:0}:x);
  overlay.innerHTML=`<div class="backdrop" id="backdrop"><aside class="drawer"><button class="close" id="close">×</button><p class="eyebrow">ISSUE DIAGNOSIS</p><h2>${esc(t.publicConcern)}</h2>${badge(t.primaryGapType)}<div class="drawer-metrics"><div><span>关注</span><b>${t.attention}</b></div><div><span>覆盖</span><b>${t.coverage}%</b></div><div><span>温差</span><b>${t.gap}</b></div></div><h3>为什么这样判断</h3><p>${esc(t.explanation)}</p><div class="frames"><span>公众：${esc(t.publicFrame)}</span><b>→</b><span>官方：${esc(t.officialFrame)}</span></div><h3>公众原话</h3>${pubs.map(x=>`<blockquote>${esc(x.text)}${x.interactions?`<small>互动量 ${x.interactions}</small>`:''}</blockquote>`).join('')}<h3>官方证据</h3>${t.officialEvidence?.length?t.officialEvidence.map(x=>`<blockquote class="official">${esc(x)}</blockquote>`).join(''):'<p class="muted">未检测到直接回答。</p>'}<div class="advice"><h3>下一轮应该回答</h3><b>${esc(t.responseQuestion)}</b><p>${esc(t.responseAdvice)}</p></div></aside></div>`;
  const close=()=>overlay.innerHTML=''; $('#close').onclick=close; $('#backdrop').onclick=e=>{if(e.target.id==='backdrop')close();};
}

function openSettings(){ overlay.innerHTML=`<div class="backdrop" id="settingsBg"><div class="modal"><button class="close" id="closeSettings">×</button><p class="eyebrow">AI SEMANTIC MODE</p><h2>配置 AI Gateway</h2><p>前端只保存 Gateway URL，不保存 OpenAI API Key。</p><label>Gateway URL<input id="endpoint" value="${esc(state.endpoint)}" placeholder="https://your-worker.workers.dev"></label><div class="actions"><button id="clearEndpoint">清除</button><button class="primary" id="saveEndpoint">保存并启用 AI</button></div></div></div>`;
  const close=()=>overlay.innerHTML=''; $('#closeSettings').onclick=close; $('#settingsBg').onclick=e=>{if(e.target.id==='settingsBg')close();};
  $('#clearEndpoint').onclick=()=>{state.endpoint='';localStorage.removeItem('gap-ai-endpoint');close();toast('已清除 Gateway。');};
  $('#saveEndpoint').onclick=()=>{const v=$('#endpoint').value.trim().replace(/\/$/,'');if(!/^https?:\/\//.test(v)){toast('请输入有效 URL。',true);return;}state.endpoint=v;state.mode='ai';localStorage.setItem('gap-ai-endpoint',v);localStorage.setItem('gap-analysis-mode','ai');close();setModePill();toast('AI 模式已启用。');if(state.page==='input')renderInput();};
}

function download(r){const blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${r.title.replace(/[^\w\u4e00-\u9fa5-]+/g,'-')}-舆情温差-V2.json`;a.click();URL.revokeObjectURL(url);}
function toast(msg,error=false){const n=document.createElement('div');n.className=`toast ${error?'error':''}`;n.textContent=msg;document.body.appendChild(n);requestAnimationFrame(()=>n.classList.add('show'));setTimeout(()=>{n.classList.remove('show');setTimeout(()=>n.remove(),200)},2600);}
function setPage(page){state.page=page;document.querySelectorAll('.nav-btn[data-page]').forEach(b=>b.classList.toggle('nav-active',b.dataset.page===page));page==='overview'?renderOverview():renderInput();window.scrollTo({top:0,behavior:'smooth'});}

document.querySelectorAll('.nav-btn[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
$('#settingsBtn').onclick=openSettings; $('#brandHome').onclick=()=>setPage('overview');
state.result=analyze(state.input); renderOverview();
