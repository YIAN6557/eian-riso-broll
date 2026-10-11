# eian-riso-broll · 孔版双色信息 B-roll

给一份口播逐字稿，挑出适合做成信息动画的段落，产出 1080×1920 竖屏 mp4（只有画面，不带音轨）。纯 HTML/CSS/GSAP，本机 Chrome 逐帧渲染，**零 npm 依赖、不调用任何图片生成模型**。

| 数字冲击 | 收敛归类 | 前后对比（真实比例） | 金句（满版深底） |
|---|---|---|---|
| ![](demo/number.gif) | ![](demo/converge.gif) | ![](demo/compare.gif) | ![](demo/quote.gif) |

> GIF 已压缩（为了体积关掉了纸纹呼吸和慢推镜）；成片是 30fps H.264，不带音轨（声音统一在剪辑台处理）。

一段 1 分钟的口播 → 10 条信息动画，10 个模板各用一次（末帧，暂停即海报）：

![](demo/sheet.jpg)

文案来自一段**虚构的示例逐字稿**：[examples/demo-script.md](examples/demo-script.md)（含分镜表和配套字幕）。屏幕上的每个字都摘自原话。

## 风格

一张纸，两种专色油墨：

- **A 墨**（深）负责所有要读的字和结构线；**B 墨**（荧光）一帧只做一处重点。
- 两墨正片叠底：重叠处自动出现第三色。
- B 版整版 3px 套印错位；所有“渐变”都用网点。
- 动画就是“这张海报被印出来的过程”：网点显影、套印归位、盖章砸落、滚筒刷过、铅字升起。
- 思源宋体 Heavy 做标题，Oswald 做数字（字体随 skill 分发，任何系统渲出来一样）。四组色本：墨蓝×荧光粉、深青×橙、藏青×朱红、墨黑×明黄。

## 和常见“AI 信息动画”不一样的地方

| | |
|---|---|
| **模板，不是手写** | 10 个可直接渲染的模板，只改 `DATA`；版面按字数自动排（`fit` / 按字形墨迹对齐） |
| **样帧 = 成片末帧** | 同一个文件、同一个 seek 渲出来，结构上一致 |
| **自动质检** | 安全区、短视频右侧按钮栏、字号、对比度、文字互压、成片时长与尺寸；输出带红框的叠层图 |
| **时长跟着口播** | `timing.mjs` 从 SRT 里找到那句话的入点出点，或按语速估算 |
| **不编内容** | 屏幕字只从原话里摘；台词没给的类别名留空；没有真截图就只放“待替换”占位 |

## 安装

```bash
git clone <本仓库> ~/.claude/skills/eian-riso-broll
node ~/.claude/skills/eian-riso-broll/scripts/check_setup.mjs
```

依赖：Node ≥ 22、Chrome/Chromium、ffmpeg。字体已经放在 `assets/fonts/`，不用另装。

## 使用

对 Claude 说：

- 「用 eian-riso-broll 给这期逐字稿做信息动画：……」→ 选段表 → 样帧 → 成片
- 「把这句做成 Riso 动画，直接出片：『做一张信息图，以前要 40 分钟，现在 2 分钟』」

手动：

```bash
P=$(node scripts/new_project.mjs 2026-10-07-第12期)
cp templates/number.html $P/compositions/01-number.html   # 改 DATA
node scripts/render.mjs $P/compositions/*.html --still      # 样帧 + contact sheet
node scripts/qa.mjs     $P/compositions/*.html              # 质检
node scripts/render.mjs $P/compositions/*.html              # 成片
node scripts/render.mjs $P/compositions/01-number.html --alpha # 透明底 ProRes 4444
```

浏览器直接打开任意 composition 即可预览（循环播放，`?t=end` 定格）。

## 结构

每个文件只负责一件事。

**给 Claude 读的**（流程和规则）

| 文件 | 负责 |
|---|---|
| `SKILL.md` | 入口：什么时候用、三道门流程、不可违反的规则、常见坑 |
| `references/copy.md` | 选段与文案：哪些段落值得做、怎么从原话里摘屏幕字、时长 |
| `references/templates.md` | 10 个模板的用途、画面故事、DATA 字段、选择树 |
| `references/style.md` | 视觉系统：纸、两墨、叠印、网点、色本、版面、字体、禁区 |
| `references/motion.md` | 动效原则 + `riso.js` API + 写新模板的检查单 |
| `references/production.md` | 渲染、质检、交付、排错 |

**在浏览器里跑的**（每条动画就是一个网页）

| 文件 | 负责 |
|---|---|
| `templates/*.html` | 10 个模板。每个只有三块：`DATA`（给使用者改）、版面、时间轴 |
| `assets/riso.css` | 样式：色本、字体、油墨 / 网点 / 纸纹部件 |
| `assets/riso.js` | 动效库：时间轴 helper、排版工具（`setup` / `text` / `fit` / `markUnder` / `inkBox`）、版面安全区 `ZONE`（唯一来源）、版面自检 |
| `assets/gsap.min.js` | GSAP 3 动画引擎（第三方，GreenSock 标准许可） |
| `assets/fonts/` | 随 skill 分发的字体（OFL）及许可证 |

**命令行**（全部是 Node，零 npm 依赖，macOS / Linux / Windows 通用）

| 文件 | 负责 |
|---|---|
| `scripts/render.mjs` | 逐帧渲染：mp4 / 透明底 mov / 样帧 / contact sheet |
| `scripts/qa.mjs` | 质检：版面（安全区、字号、对比度、互压）+ 成片（时长、尺寸），出叠层图 |
| `scripts/timing.mjs` | 口播时长：SRT 精确定位 / 按语速估算 |
| `scripts/new_project.mjs` | 新建一个自包含的视频项目 |
| `scripts/check_setup.mjs` | 环境自检 |
| `scripts/lib/chrome.mjs` | headless Chrome 驱动（找浏览器、启动、截图） |
| `scripts/lib/project.mjs` | 项目目录：skill 根路径、建项目、拷模板 |
| `scripts/lib/media.mjs` | ffmpeg / ffprobe：拼 contact sheet、读成片参数 |
| `scripts/lib/args.mjs` | 命令行参数解析 |

**维护用**

| 文件 | 负责 |
|---|---|
| `tests/smoke.mjs` | 一键自测：全部模板 → 样帧 → 成片 → 质检 → 时长脚本 |
| `evals/evals.json` | 行为评测：Claude 用这个 skill 时该怎么做 |
| `examples/` | 虚构示例逐字稿 + 分镜表 + 字幕；模板默认 DATA 和 demo 都来自它 |
| `tools/build_demo.mjs` | 重新生成 `demo/` |
| `tools/build_fonts.py` | 从上游开源字体重新生成 `assets/fonts/` |
| `demo/` | README 用的 GIF 和末帧总览 |
