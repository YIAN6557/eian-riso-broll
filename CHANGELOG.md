# Changelog · 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

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
