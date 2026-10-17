# Changelog · 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 修复

- `compare` 保留小数精度，去掉对比条的 14px 最短长度，零值与极端比例按真实数量绘制。
- `steps` 六步时缩小的编号改用 A 墨，符合小于 100px 文字的对比度要求。
- 渲染与 QA 等待截图解码；缺失或损坏图片明确报错，避免坏图仍被判为通过。
- 新增浏览器回归，并接入 Ubuntu、macOS、Windows 的 CI。

- 同一帧文字重复：版头主题词常常和标题、正文是同一个词（如版头「年终奖」、标题「年终奖」、选项又是「年终奖」），字幕短的时候尤其明显。
  - `references/copy.md` 新增「同一帧不重复」规则：版头写更上一层的分类，标题写总称、不能是选项之一。
  - `qa.mjs` 新增重复检查，命中即 error，在样帧阶段拦下。
  - 默认模板里的两处重复一并修正：`focus` 版头「色本」→「风格」，`shot` 版头「分镜」→「原件」。

## [1.0.0] - 2026-10-11

首个公开版本。First public release.

### 内容

- 10 个模板：误区翻转 `versus`、章节卡 `title`、数字冲击 `number`、前后对比 `compare`、收敛归类 `converge`、连接密度 `network`、多选一 `focus`、流程步骤 `steps`、截图锚点 `shot`、金句 `quote`。
- 孔版双色视觉系统：两种油墨、叠印第三色、套印错位、网点；四组配色。
- 三道确认门的工作流：分镜表 → 样帧 → 成片；屏幕文字只摘原话。
- 渲染：1080×1920 / 30fps H.264 mp4，透明底 ProRes 4444，样帧与 contact sheet。
- 自动质检：安全区、短视频右侧按钮栏、字号、对比度、文字互压、成片时长与尺寸，并输出叠层图。
- 时长脚本：从 SRT 精确定位入点出点，或按语速估算。
- 内置字体（思源宋体、思源黑体、Oswald、JetBrains Mono），macOS / Linux / Windows 渲染结果一致。
- 一段虚构的示例逐字稿，模板默认数据、demo 和评测用例都来自原创文案。
- 一键自测 `tests/smoke.mjs`，以及 GitHub Actions 持续检查（Ubuntu 全量，macOS / Windows 抽测）。

### 许可

- Eian 个人非商业使用许可 1.0：个人非商用免费，商业使用需事先书面授权。

[1.0.0]: https://github.com/YIAN6557/eian-riso-broll/releases/tag/v1.0.0
