# eian-riso-broll · Agent 操作指南

这个仓库是一套做孔版双色（Riso）风格口播信息动画的工作流，可以在 **Claude Code、Codex、Cursor、Gemini CLI** 等 AI 编码助手里使用。

## 这个文件的作用

- **Claude Code** 通过 `SKILL.md` 顶部的 frontmatter 自动识别并加载，无需本文件。
- **Codex 及其他读取 `AGENTS.md` 的助手**：本文件是入口。完整的工作流、模板字段、文案规则和渲染命令都在 `SKILL.md` 和 `references/` 里——**请把 `SKILL.md` 当作操作手册来读和执行**（忽略它顶部的 YAML frontmatter，那是 Claude Code 的元数据）。`SKILL.md` 是唯一权威来源，本文件与它冲突时以 `SKILL.md` 为准。

## 什么时候用

用户给出一份口播逐字稿（可附 SRT 字幕），想做成高对比杂志感的 9:16 竖屏信息动画时。用户说「Riso 动画」「孔版风 B-roll」「逐字稿做信息动画」「口播配信息动画」「信息图 B-roll」时，也用这套工作流。

## 先跑环境自检

```bash
node scripts/check_setup.mjs
```

需要 Node ≥ 22、Chrome/Chromium、ffmpeg。字体随仓库分发，macOS / Linux / Windows 渲染一致。找不到 Chrome 时设环境变量 `CHROME=<可执行文件路径>`。

## 工作流：三道确认门（完整步骤见 SKILL.md）

1. **选段 → 分镜表**：按 `references/copy.md` 读逐字稿，产出选段表。**停下，等用户确认。**
2. **样帧**：套模板、只改 `DATA`，渲末帧 + 跑质检（`references/production.md` 有命令）。**停下，等用户确认。**
3. **成片**：渲 mp4 + 再质检，交付。

选模板看 `references/templates.md`，视觉规则看 `references/style.md`，动效 API 看 `references/motion.md`。

## 不可违反（与 SKILL.md 一致）

1. 屏幕文字只来自逐字稿原话，不编。
2. 没有真截图就不画界面。
3. 小于 100px 的字只用 A 墨（深色）。
4. 信息只在 y 168–1330 的信息区。
5. 质检（`node scripts/qa.mjs`）有 error 不交付。
6. 不做音效，成片只有画面、没有音轨。

## 不做

情绪独白、隐喻、软件操作演示不做，建议归实拍 / 角色动画 / 录屏。
