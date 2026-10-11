# eian-riso-broll

**孔版印刷风格的口播信息动画 · 一个 Claude Code skill**

中文 · [English](README.en.md)

把口播逐字稿交给 Claude，它会挑出值得配画面的句子，做成孔版双色风格的竖屏信息动画（1080×1920 mp4），拖进剪辑软件就能用。

| 数字冲击 | 收敛归类 | 前后对比 | 金句 |
|:---:|:---:|:---:|:---:|
| ![](demo/number.gif) | ![](demo/converge.gif) | ![](demo/compare.gif) | ![](demo/quote.gif) |

一段 1 分钟的口播做出来的 10 条动画（每条的最后一帧）：

![一段口播做出来的 10 条动画](demo/sheet.jpg)

> 上面的文案来自一段[虚构的示例逐字稿](examples/demo-script.md)，屏幕上的每个字都摘自原话。GIF 为了体积做了压缩，成片是 30fps 高清 mp4。

## 适合谁

做口播、知识分享类短视频的人。你在镜头前讲，观众耳朵在听；这个 skill 负责让观众**同时看见**你说的那个数字、那个对比、那个结论。

- **你给**：一份逐字稿（有 SRT 字幕更好）。
- **你拿到**：每个画面一条 mp4（只有画面、没有声音），一张分镜表，一张全部画面的总览图。需要叠在人像上时，还可以出透明底版本。

## 为什么用它

- **像一个系列，不像拼凑的 PPT**：10 个模板共用同一套纸张、油墨、字体和版头，放在一期视频里风格统一。
- **画面跟着口播走**：每条动画的长度按你说那句话的时长来定；有字幕时精确到入点出点。
- **不替你编内容**：屏幕上的字只从你说的话里摘，没说的类别名、数据一律不补；你没给截图，就只放“待替换”占位，不画假界面。
- **先确认再出片**：先给你一张分镜表，再给你看每条的样帧，你点头了才渲染成片，改起来不费劲。
- **为竖屏短视频设计**：自动避开平台顶栏、底部字幕区和右侧点赞按钮栏，每条都会自动检查字号、对比度、有没有出画。
- **免费、离线、本机渲染**：不调用任何图片生成模型，不需要联网；字体已经内置，Mac、Windows、Linux 渲出来一模一样。

## 安装

需要先装好这几样：

- [Claude Code](https://claude.com/claude-code)
- [Node.js](https://nodejs.org) 22 或更新
- Chrome（Edge 或 Chromium 也可以）
- [ffmpeg](https://ffmpeg.org)（macOS 可以用 Homebrew：`brew install node ffmpeg`）

然后把 skill 放进 Claude Code 的 skills 目录，跑一次环境自检：

```bash
git clone https://github.com/YIAN6557/eian-riso-broll.git ~/.claude/skills/eian-riso-broll
node ~/.claude/skills/eian-riso-broll/scripts/check_setup.mjs
```

看到“全部通过”就可以用了。Windows 上把 `~/.claude/skills` 换成 `%USERPROFILE%\.claude\skills`。

## 怎么用

直接跟 Claude 说就行，比如：

- **整期视频**：「用 eian-riso-broll 给这期逐字稿做信息动画：……（贴上逐字稿）」
- **只做一句**：「把这句做成 Riso 动画，直接出片：『做一张信息图，以前要 40 分钟，现在 2 分钟』」
- **对准口播时长**：「这是字幕文件 口播.srt，帮我把第 3 段做成动画，时长和口播对上」
- **叠在人像上**：「上一条给我一个透明背景的版本」

做整期视频时，Claude 会分三步走，每一步都停下来等你确认：

1. **分镜表**：哪句话配什么画面、屏幕上写什么字、多长时间。删哪条、换哪条，在这一步说最省事。
2. **样帧**：每条动画的最后一帧拼成一张总览图给你看。构图、文字不满意，在这一步改。
3. **成片**：渲染出 mp4，再自动检查一遍时长和尺寸。

如果只给一句话，或者说了“直接出片”，Claude 会合并步骤直接做，但检查一步都不会少。

成片默认放在 `~/eian-riso-broll-projects/<项目名>/renders/`，每条一个 mp4。

## 10 个模板

编号和上面总览图的顺序一一对应。

| # | 模板 | 什么时候用 | 示例里的那句话 |
|---|---|---|---|
| 01 | 误区翻转 `versus` | “很多人以为……其实……” | 好看的动效得请人来做 → 一份逐字稿就够了 |
| 02 | 章节卡 `title` | 第一部分、第二部分……；开场标题 | 第一部分，先看效果 |
| 03 | 数字冲击 `number` | 一个扛得住整个画面的数字 | 12 处值得配画面的信息 |
| 04 | 前后对比 `compare` | 同一件事的两个量，按真实比例画条 | 以前 40 分钟，现在 2 分钟 |
| 05 | 收敛归类 `converge` | 很多 → 很少 | 30 多套工程 → 4 类 |
| 06 | 连接密度 `network` | 数量 + 关系、连接、规模感 | 1800 条画面，放在一起是一个系列 |
| 07 | 多选一 `focus` | 几个并列项里突出一个 | 四组色本，70% 的视频用第一组 |
| 08 | 流程步骤 `steps` | 2–6 个有先后顺序的步骤 | 只有 3 步：选段、出样帧、渲成片 |
| 09 | 截图锚点 `shot` | 观众得看见原件才信（后台、原帖、表格） | 上周的分镜表（截图由你提供） |
| 10 | 金句 `quote` | 整期的钩子或结论，深色满版 | 画面要跟着你说的话走 |

## 四组配色

| 配色 | 气质 |
|---|---|
| 墨蓝 × 荧光粉（默认） | 最有孔版味，适合知识、科技 |
| 深青 × 橙 | 温暖，适合方法论、生活 |
| 藏青 × 朱红 | 适合观点、误区、提醒 |
| 墨黑 × 明黄 | 克制，适合严肃话题、数据、财经 |

一期视频最多用两组：正文一组，开头和结尾一组，首尾呼应。想换颜色，直接跟 Claude 说就行。

## 它不做什么

- **不配声音**：成片只有画面，配音、音效、BGM 都留在剪辑软件里处理。
- **不做非信息类画面**：情绪独白、讲故事、打比方、软件操作演示，更适合实拍、角色动画或录屏，Claude 会直接告诉你。
- **不画假截图**：需要展示原件的地方，请提供真实截图。
- **目前只做竖屏**：1080×1920。

## 常见问题

**渲染要多久？**
在 M 系列 Mac 上，5 秒的一条大约 15–20 秒。样帧几秒一张。

**能自己改文字吗？**
能。每条动画是项目里 `compositions/` 下的一个 html 文件，用浏览器打开就能预览（循环播放）。改文件顶部的 `DATA`，再让 Claude 重新渲染就行。

**字太多放不下怎么办？**
Claude 会从原话里删字，而不是把字号缩小。手机上看，字太小等于没有。

**为什么有的字显示成别的字体？**
内置字体收录了 6763 个常用汉字，极少数生僻字会用系统字体代替。

**提示找不到 Chrome？**
设置环境变量 `CHROME=<浏览器程序的路径>` 再试；`check_setup.mjs` 会告诉你具体原因。

## 不经过 Claude，手动用

```bash
cd ~/.claude/skills/eian-riso-broll
P=$(node scripts/new_project.mjs 第12期)                    # 新建项目，打印项目路径
cp templates/number.html "$P/compositions/01-number.html"    # 复制模板，改顶部的 DATA
node scripts/render.mjs "$P"/compositions/*.html --still     # 样帧 + 总览图
node scripts/qa.mjs     "$P"/compositions/*.html             # 自动检查
node scripts/render.mjs "$P"/compositions/*.html             # 成片 mp4
node scripts/render.mjs "$P/compositions/01-number.html" --alpha   # 透明底（ProRes 4444）
```

更多细节见 [references/production.md](references/production.md)。

## 想改这个 skill？

代码结构、自测和维护脚本见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 致谢与许可

- 本仓库的代码与文档：见 [LICENSE](LICENSE)。
- 动画引擎 [GSAP](https://gsap.com)（`assets/gsap.min.js`）：GreenSock 标准许可，可免费商用，不受本仓库许可证覆盖。
- 内置字体：思源宋体、思源黑体（Noto Serif / Sans SC）、Oswald、JetBrains Mono，均为 SIL Open Font License，详见 [assets/fonts/](assets/fonts/)。
- 三道确认门、只摘原话这些工作流上的想法，受到 gbro-collage-info 的启发。
