# 舆情温差 V2 · Public Opinion Gap

> 官方回应了很多，但回应的是公众真正关心的问题吗？

“舆情温差”不是舆情热度与回应强度的差，而是**官方解释议题与公众关切议题之间的信息缺口**。V2 在 V1 的“关注度 × 解释覆盖度”基础上，进一步区分四类不同的温差，并提供可选的大模型语义分析模式。

## V2 核心升级

### 1. 四类舆情温差

| 类型 | 含义 | 典型情况 |
|---|---|---|
| 未回应温差 | 公众高频追问，官方没有直接回答 | 公众问“谁负责”，通报未涉及责任主体 |
| 解释不足温差 | 官方提到了，但关键细节没有闭合 | 只说“已处罚”，没有说明具体处罚和依据 |
| 重点错位温差 | 双方都谈到了，但官方强调程度明显低于公众关注 | 公众大量关心赔偿，官方只在末尾一句带过 |
| 认知错位温差 | 官方和公众不在同一个问题框架 | 公众问“为什么发生”，官方主要回答“怎么处罚” |

“基本对齐”不是温差类型，表示公众问题已经得到较直接、充分且框架一致的解释。

### 2. 双分析引擎

**本地可解释模式**

- 零依赖、零上传、直接运行；
- 使用议题规则、中文文本相似度、回答框架和关注权重判断；
- 适合 GitHub Demo、快速验证和无 API 环境。

**AI 语义模式**

- 通过服务端 Gateway 调用大模型；
- 开放式聚类公众议题，不局限于固定标签；
- 判断“是否真正回答原问题”，而不是只看关键词；
- 更适合识别隐含追问、跨句回答和认知框架错位。

### 3. 互动量权重

公众评论支持两种输入：

```text
为什么一直没有回应？
```

或：

```text
286 | 为什么一直没有回应？
```

数字会被视为互动量，纳入公众关注权重。也支持：

```text
为什么一直没有回应？ | 286
```

### 4. 下一轮回应清单

系统自动生成“下一轮最该回答的 3 个问题”，每个问题包含：

- 为什么应优先回答；
- 当前属于哪一种温差；
- 建议补充哪些信息维度；
- 对应公众原话与官方证据。

## 项目结构

```text
public-opinion-gap-v2/
├── index.html
├── styles.css
├── analysis-core.js       # 本地 V2 分析器 + AI 结果标准化
├── ai-client.js           # 前端 AI Gateway 客户端
├── app.js                 # 页面与交互
├── tests/
│   └── core.test.js
├── worker/
│   ├── openai-worker.js   # 可选：Cloudflare Worker OpenAI Gateway
│   ├── wrangler.toml.example
│   └── package.json
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .nojekyll
└── README.md
```

## 直接运行

前端仍然是零构建静态站点，不需要 `npm install`。

```bash
python3 -m http.server 8080
```

访问：

```text
http://localhost:8080
```

也可以直接打开 `index.html` 使用本地模式。

## GitHub Pages 部署

1. 新建 GitHub 仓库；
2. 将本项目文件推送到 `main`；
3. 打开 `Settings → Pages`；
4. Source 选择 `GitHub Actions`；
5. 项目中的 `.github/workflows/deploy.yml` 会自动部署静态页面。

只使用本地模式时，到这里就完成了。

## 启用 AI 语义模式

GitHub Pages 是公开客户端环境，不应把 OpenAI API Key 写入 `app.js`、HTML、GitHub 仓库或浏览器 Local Storage。因此 V2 使用如下结构：

```text
GitHub Pages
    │
    │  官方材料 + 公众材料
    ▼
AI Gateway / Cloudflare Worker
    │
    │  OPENAI_API_KEY（Secret）
    ▼
OpenAI Responses API
```

前端只保存 **Gateway URL**，不保存 OpenAI API Key。

### Cloudflare Worker 示例

`worker/openai-worker.js` 已经包含完整 Gateway 示例，使用 OpenAI Responses API 与 Structured Outputs。默认模型为 `gpt-5.4-mini`，可通过环境变量修改。

安装/登录 Wrangler 后，可按下列方式部署：

```bash
cd worker
cp wrangler.toml.example wrangler.toml
```

修改 `wrangler.toml` 中的：

```toml
ALLOWED_ORIGIN = "https://YOUR_GITHUB_NAME.github.io"
```

然后设置 Secret：

```bash
npx wrangler secret put OPENAI_API_KEY
```

最后部署：

```bash
npx wrangler deploy
```

得到 Worker URL 后，在“舆情温差 V2 → AI 设置”中填入该 URL，即可切换 AI 语义分析。

> 建议将 `ALLOWED_ORIGIN` 设置为实际 GitHub Pages 域名，避免公开 Worker 被其他网页直接调用。生产环境还可以进一步加入限流、鉴权和成本控制。

## AI 输出原则

AI 模式的提示词已经固化以下原则：

- 不做泛泛的正负面情感判断；
- “提到了相关事情”不能自动算作“回应了问题”；
- 公众问“为什么”，官方只说“已处罚”，优先识别为认知错位；
- 公众证据和官方证据尽量来自输入原文，不允许杜撰事实；
- 回应建议只说明应补充哪些信息，不替官方编造事实答案；
- 仅基于用户输入材料分析，不自动调用外部搜索。

## 本地测试

需要本机已有 Node.js，但无需安装任何 npm 依赖：

```bash
node tests/core.test.js
```

## V2 指标说明

基础温差仍保留 V1 的可解释逻辑：

```text
基础温差 = 公众关注度 ×（1 − 官方解释覆盖度）
```

V2 另外计算：

- `publicShare`：该议题在公众讨论中的相对权重；
- `officialShare`：该议题在官方材料中的相对解释权重；
- `priorityGap`：公众议题权重与官方解释权重的差；
- `publicFrame / officialFrame`：公众问题框架与官方回答框架；
- `primaryGapType`：主要温差类型。

AI 模式下，数值用于排序和辅助研判，不应被理解为具有自然科学意义的“真实温度”。关键价值是**比较与解释**：哪一个问题最需要补答，以及为什么。

## 隐私与安全

- 本地模式：文本只在浏览器运行；
- AI 模式：材料会发送到你自行配置的 Gateway，再由 Gateway 调用模型；
- 前端不提供 API Key 输入框，也不会存储模型密钥；
- 不要把任何真实 API Key 提交到 GitHub 仓库。

## 后续可扩展方向

V3 可以继续加入：

- 同一事件多轮官方回应，观察温差收敛/扩大；
- CSV 批量导入评论及互动量；
- 不同平台公众关切对比；
- 媒体关注点 vs 官方解释 vs 网民关切三方温差；
- 一键生成“回应补充建议稿”与汇报截图；
- 对温差判断建立人工标注集和评测集。
