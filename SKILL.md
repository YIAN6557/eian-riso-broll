---
name: eian-riso-broll
description: 孔版双色（Riso）风格的信息 B-roll 动画。给一份口播逐字稿（可附 SRT 字幕），挑出适合做成信息动画的段落，套用 10 个现成模板（数字冲击 / 流程 / 收敛 / 前后对比 / 链接密度 / 金句 / 多选一 / 误区翻转 / 章节卡 / 截图锚点），先出静态样帧确认，再渲染 1080×1920 竖屏 mp4（无音轨；可出透明底 ProRes）。用户说「Riso 动画」「孔版风 B-roll」「eian-riso-broll」「逐字稿做信息动画」「口播配信息动画」「信息图 B-roll」，或给出逐字稿、想要高对比杂志感的竖屏信息动画时，使用此 skill。纯 HTML/CSS/GSAP 本机渲染，不调用图片生成模型；只做无角色的信息动画 —— 情绪独白、隐喻、软件操作演示不做，建议归实拍 / 角色动画 / 录屏。
license: 个人非商用免费；商业使用需事先取得书面授权（见 LICENSE、COMMERCIAL.md）
compatibility: Node ≥ 22、Chrome 或 Chromium、ffmpeg/ffprobe。字体随 skill 分发（思源宋体 / 思源黑体 / Oswald / JetBrains Mono），macOS、Linux、Windows 渲出来一样。首次使用先跑 node scripts/check_setup.mjs。
---

# Riso B-roll · 孔版双色信息动画

**风格一句话**：一张纸，两种专色油墨。**A 墨**（深）负责所有要读的字和结构；**B 墨**（荧光）一帧只做一处重点；两墨重叠的地方自动出现第三色；B 版永远有 3px 的套印错位；所有“渐变”都用网点表达。动起来像一张海报正在被印出来：网点显影、套印“咔”地归位、盖章砸落、滚筒刷过。

效果参考：`demo/`（GIF + 末帧一览）。

## 文件地图

| 要做什么 | 读哪里 |
|---|---|
| 挑段落、提炼屏幕文字 | [references/copy.md](references/copy.md) |
| 选模板、改 DATA | [references/templates.md](references/templates.md) |
| 视觉规则（色本、版面、字体、禁区） | [references/style.md](references/style.md) |
| 改动效 / 写新模板（riso.js API） | [references/motion.md](references/motion.md) |
| 渲染、质检、交付、排错 | [references/production.md](references/production.md) |

模板在 `templates/`，每个都是能直接渲染的完整 composition，**只改顶部的 `DATA`**。

## 三道门

```text
Gate 1  选段表（段落 → 模板 → 屏幕文字 → 时长）        → 停，等确认
Gate 2  样帧（每条的末帧海报 + contact sheet + QA）    → 停，等确认
Gate 3  成片（mp4 + QA）                               → 交付
```

每道门都停下来等用户。改名单在 Gate 1 最便宜，改构图在 Gate 2 最便宜。
**快速通道**：用户只给了一段、或明确说“直接出片 / 不用确认”时，可以合并门，但 QA 一步都不省。

### Gate 1 · 选段

按 [copy.md](references/copy.md) 读逐字稿，产出一张表：

| # | 原话落点 | 模板 | 屏幕文字（提炼后） | 时长 | 色本 | 截图需求 |
|---|---|---|---|---|---|---|

外加“落选段 → 去处”（录屏 / 实拍 / 合并进第 N 条）。

- 一条只讲一件“能被看见”的事：一个数字、一个结构、一次对比、一句结论。
- 相邻两条不用同一模板；同一模板全片 ≤ 2 次（章节卡系列除外）。
- `quote`（满版深底）全片 ≤ 2 条，放在钩子或结论，制造明暗节奏。
- 时长用 `scripts/timing.mjs` 算（有 SRT 用 SRT，没有按 4.5 字/秒估），不要拍脑袋写 5 秒。

### Gate 2 · 样帧

```bash
P=$(node scripts/new_project.mjs 2026-10-07-主题)    # 建项目，assets 整份拷入
cp templates/number.html $P/compositions/01-xxx.html  # 每条一个文件，按 01- 02- 编号
# 只改 DATA → 渲样帧 → 质检
node scripts/render.mjs $P/compositions/*.html --still   # plates/*.png + plates/sheet.jpg
node scripts/qa.mjs     $P/compositions/*.html           # qa/*-audit.png；有 error 必须修
```

自己先读 `plates/sheet.jpg` 和有问题的 `qa/*-audit.png`，修完 error 再把 sheet 发给用户。样帧就是成片的最后一帧——**样帧和成片同一个文件渲出来，天然一致**。

### Gate 3 · 成片

```bash
node scripts/render.mjs $P/compositions/*.html           # renders/*.mp4（H.264，无音轨）
node scripts/qa.mjs     $P/compositions/*.html           # 再查一遍：时长、尺寸
```

交付：`renders/*.mp4` + `plates/sheet.jpg` + `STORYBOARD.md`（填好分镜表）。问用户要不要：透明底版本（`--alpha` → ProRes 4444 `.mov`，叠在口播画面上用）、拷到指定目录。

## 不可违反

1. **屏幕文字只来自逐字稿原话**：数字、名词、原句的子串。台词没说的（第 4 个类别叫什么、具体百分比）就留空，不编。能做的只有“删字”和“换行”，不改写意思。
2. **没有真截图就不画界面**：`shot` 模板没图时只显示“截图 · xxx · 待替换”占位，不加批注框。
3. **小于 100px 的字只用 A 墨**；B 墨只给大数字、压条、色块。
4. **信息只在 y 168–1330**；下面是字幕床，只放网点地层。
5. **QA 有 error 不交付**。
6. **不做音效**：成片只有画面、没有音轨；不加拟音、不配 BGM，声音统一在剪辑台处理。

## 常见坑（写新模板 / 改版面时）

- 嵌套元素不会自动 `position:absolute`（只有 `#stage` 的直接子元素会）——容器里的子元素要自己写。
- **先排版、后建时间轴**：`fit()` / `inkBox()` 要在任何 tween 之前调用，否则量到的是动画初始态。
- 数字按**墨迹**对齐（`Riso.inkBox`），不要按行框——数字字体的字形会超出行框。
- 多行文本用 `Riso.text(el, '第一行\n第二行[重点]')`，不要直接 `textContent`，否则逐字升起不生效。
