# 参与开发 · Contributing

这份文档给想改这个 skill 的人：代码结构、怎么自测、怎么重新生成 demo 和字体。只是想用它做视频，看 [README](README.zh-CN.md)（[English](README.md)）就够了。

> English: this guide covers the code layout, the self-test and the maintenance scripts. Commands are the same on every OS; the prose is in Chinese.

## 结构：每个文件负责什么

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

## 改完之后：自测

改过 `assets/`、`scripts/` 或模板之后跑一遍：

```bash
node tests/smoke.mjs                                    # 全部模板：样帧 → 成片（--draft）→ 质检 → 时长脚本；失败时退出码 1
node tests/smoke.mjs --full --out ~/Desktop/riso-review # 正式码率，产物留在指定目录里看效果
node tests/smoke.mjs number quote                       # 只测指定模板
```

`shot` 模板会额外派生一条带示例截图的 `shot-image`，用来检查截图的双色调效果。

除了自测，还要自己看两样 QA 查不出来的东西：

- `--at 0`：第 0 帧是不是干净（只有纸、纸纹和底部网点地层）。
- `plates/sheet.jpg`：每帧有没有一个主角，B 墨重点是不是只有一处。

## 写新模板

复制最接近的模板改，检查单在 [references/motion.md](references/motion.md#写新模板)。模板的默认 `DATA` 要来自 [examples/demo-script.md](examples/demo-script.md) 那段示例逐字稿；新模板需要新段落时，把段落加进逐字稿和 `examples/demo.srt`。

## 重新生成 demo

改了模板或样式，README 里的图要跟着更新：

```bash
node tools/build_demo.mjs        # → demo/sheet.jpg + demo/*.gif
```

GIF 用 `render.mjs --calm` 渲（关掉纸纹呼吸和慢推镜），否则每帧整屏都在变，GIF 会大十几倍。

## 重新生成字体

`assets/fonts/` 是从 [google/fonts](https://github.com/google/fonts/tree/main/ofl) 的上游字体裁剪出来的（只留 GB2312 常用字）。要换字重或扩字符集：

```bash
pip install fonttools brotli
python3 tools/build_fonts.py <上游字体目录>     # 需要哪些上游文件见脚本开头的说明
```

## 贡献的授权

本仓库采用 [Eian 个人非商业使用许可 1.0](LICENSE)，商业使用另行书面授权。向本仓库提交代码、文档或其他内容（issue 里的补丁、pull request 等），即表示你确认有权提交这些内容，并同意 YIAN6557 可以按本仓库的个人非商业使用许可和商业授权条款使用、修改、再授权这些内容。

By contributing, you confirm you have the right to submit your contribution and agree that the rights holder may use, modify and license it under both the personal use license and commercial licenses.

## 行为评测

[evals/evals.json](evals/evals.json) 描述 Claude 用这个 skill 时应该怎么做（选段停下等确认、不编数据、文字太长时删字而不是缩字……）。改了 `SKILL.md` 或 `references/` 之后，用这些用例让 Claude 实际跑一遍，对照 assertions 检查。
