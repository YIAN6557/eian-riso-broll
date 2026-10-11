# 渲染 · 质检 · 交付 · 排错

## 环境

`node scripts/check_setup.mjs` 一次查完：Node ≥ 22（渲染器用 Node 自带的 WebSocket 驱动 Chrome，**零 npm 依赖**）、Chrome/Chromium（会真的启动一次；找不到时设 `CHROME=<路径>`，也会自动找 Playwright 下载的 Chromium）、ffmpeg/ffprobe、字体文件。

字体随 skill 分发（`assets/fonts/`，见那里的 README），不依赖系统字体，所以 macOS / Linux / Windows 渲出来一样。字体没加载上时页面会报错、渲染中止，不会悄悄换成系统字体出片。

## 项目结构

```
<项目>/                          node scripts/new_project.mjs <名字> 生成；默认在 ~/eian-riso-broll-projects/
├── assets/                     riso.css / riso.js / gsap / fonts —— 整份拷入，项目自包含
│   └── shots/                  真截图放这里
├── compositions/NN-名字.html    每条一个，从 templates/ 复制
├── plates/                     样帧 PNG + sheet.jpg
├── renders/                    成片
├── qa/                         质检叠层图
└── STORYBOARD.md               分镜表（Gate 1 的表 + 截图待替换清单）
```

## 命令

```bash
S=~/.claude/skills/eian-riso-broll/scripts      # 或 skill 的实际安装路径

node $S/render.mjs compositions/*.html --still     # 末帧样帧 → plates/<id>.png + plates/sheet.jpg
node $S/render.mjs compositions/03-x.html --at 1.2 # 任意时刻（查动画中间态）
node $S/render.mjs compositions/*.html             # 成片 → renders/<id>.mp4
node $S/render.mjs compositions/*.html --draft     # 快速低码率预览
node $S/render.mjs compositions/*.html --calm      # 纸纹不动、不推镜：只给压 GIF 用，别交付
node $S/render.mjs compositions/01-x.html --alpha  # 透明底 → renders/<id>.mov（ProRes 4444）
node $S/qa.mjs compositions/*.html                 # 质检 → qa/<id>-audit.png，error 时退出码 1
node $S/timing.mjs --srt 口播.srt "某句台词"         # 精确入点 / 出点 / 建议时长
```

浏览器里直接打开 composition 可以预览：自动循环播放；`?t=end` 或 `?t=2.4` 定格到某一刻。

速度参考（M 系列 Mac）：样帧 ~2 秒一张；成片 5 秒一条约 20 秒。

改过 `assets/`、`scripts/` 或模板之后，跑一遍自测：

```bash
node tests/smoke.mjs                 # 全部模板：样帧 → 成片（--draft）→ 质检 → 时长脚本；失败时退出码 1
node tests/smoke.mjs --full --out ~/Desktop/riso-review   # 正式码率，产物留在指定目录里看效果
node tests/smoke.mjs number quote    # 只测指定模板
```

## 渲染器怎么工作

`render.mjs` 启动 headless Chrome → 打开 `composition.html?render` → 读 `window.__riso.meta()`（时长、帧率）→ 逐帧 `seek(t)` + 截图 → 管道喂给 ffmpeg（H.264 CRF 18，码率上限 24 Mbps，不写音轨）。

样帧和成片是**同一个文件、同一个 seek**渲出来的，所以“成片末帧 = 确认过的样帧”是结构保证的，不靠人对。

## 质检（qa.mjs）

在“镜头归零”的版面坐标里量末帧：

| 检查 | 级别 |
|---|---|
| 文字越出信息区（y 168–1330、x 56–1024） | error |
| 字号 < 28px | error |
| 小于 100px 的字对比度 < 4.5 | error |
| 文字互相压住（未标 `data-overprint`） | error |
| `fit()` 缩到最小仍放不下 | error |
| 压到右侧按钮栏（x > 930、y 880–1500），逐行量 | warn |
| 大字对比度偏低 | warn |
| 成片：时长不符、尺寸不是 1080×1920 | warn / error |

每条都会生成 `qa/<id>-audit.png`：绿虚线 = 信息区，橙色 = 按钮栏，斜纹 = 字幕床，红框编号 = 问题元素。有问题先看这张图。

QA 查不了的，自己看：
- `plates/sheet.jpg`：每帧有没有一个主角？B 墨重点是不是只有一处？
- `--at 0`：第 0 帧是不是干净（只有纸、纸纹和底部网点地层，没有“0”、虚线框、淡影）？
- 文字是不是全部来自原话？

## 交付

- `renders/*.mp4`：1080×1920 / 30fps / H.264，**无音轨**、无字幕（口播、BGM、字幕都在剪辑台合成）。
- `plates/sheet.jpg`：末帧一览。
- `STORYBOARD.md`：分镜表 + 截图待替换清单（哪条、哪个 `slot`、要什么截图）。
- 可选：`--alpha` 透明底 ProRes 4444（纸被拿掉，只剩油墨；适合叠在口播画面上半屏）。注意：
  - 体积大（4.5 秒约 340MB），这是 ProRes 4444 的正常水平，只给剪辑师用，不要直接上传平台。
  - A 墨是深色，叠在暗的口播画面上会看不清——适合明亮的画面；暗画面用普通 mp4 整屏切过去。
- 问用户是否拷到指定目录。

## 排错

| 现象 | 原因 / 解决 |
|---|---|
| 元素全堆在左上角 | 嵌套元素没有 `position:absolute`（只有 `#stage` 的直接子元素自动绝对定位） |
| 数字顶上被切掉 | 对 `.num` 做了 `clip-path`/`overflow:hidden`；用 `C.roll`（自带 30% 余量）或按 `inkBox` 留空间 |
| 位置量错、动画后错位 | 在建时间轴**之后**才 `fit`/`inkBox`——排版必须在任何 tween 之前 |
| 逐字升起没效果 | 没用 `Riso.text()`，直接写了 `textContent` |
| 容器 `right:` 不生效、宽度为 0 | 父容器是 0 宽的绝对定位元素；给父容器 `inset:0` |
| 页面脚本报错 | 渲染器会把页面的 console error 原样打出来；浏览器打开 composition 看控制台 |
| `fit() 缩到最小字号仍放不下` | 删字。不要调小 min、不要改 CSS |
| 渲染卡住 / Chrome 启动超时 | 有残留的 headless Chrome：`pkill -f riso-chrome` |
| Chrome 启动失败 | 报错里会带 Chrome 自己的最后几行输出。root 身份（Docker / CI）下会自动加 `--no-sandbox` |
