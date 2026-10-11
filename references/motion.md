# 动效

## 原则

成片**只有画面、不带音轨**——本 skill 不做音效，声音统一在剪辑台处理。

**动画 = 这张海报被印出来的过程。** 每个动作都要对应一个印刷动作：

| 印刷动作 | 动效 | API |
|---|---|---|
| 一层墨被印上去 | 网点从小长满 | `C.print` |
| 两版对准 | B 版从大偏移跳 4 格归位 | `C.register` |
| 盖章 | 从空中加速砸下，镜头震 3 帧 | `C.stamp` |
| 滚筒刷过 | clip-path 从一侧扫开 | `C.roll` |
| 铅字排上 | 逐字从行底升起 | `C.rise` |
| 色条 / 线被拉出 | scaleX 从 0 长出 | `C.bar` |
| 油墨被抽掉 | 平网点径缩小（退后） | `tl.fromTo(el, {'--td':'9px'}, {'--td':'4px'})` |

规矩：

1. **第 0 帧干净：只有纸、纸纹和字幕床网点地层**（`quote` 例外：满版墨底 + 网点太阳）。文字、数字、框线、色块都从自己的入场动作开始出现，不在第 0 帧摆一个“0”或淡影。`C.print` / `C.count` / `C.draw` 会自动在入场前隐藏元素；其他手写的动作用 `C.hideUntil(sel, t)`。地层本身保证画面不是空纸，从口播硬切进来不会像卡顿。
2. **入场快、落点准、停得住。** 入场用 `expo.out` / `back.out`；盖章用 `power3.in`（加速撞上去才有重量）。主要信息在 2–2.5 秒内全部到位，剩下的时间是“暂停即海报”。
3. **静止不等于死。** `C.camera()` 匀速慢推 3%，`C.boil()` 让油墨颗粒逐两帧换位。匀速（不缓入缓出）是故意的：剪辑师会在任意一帧切入切出。
4. **一条只有一个高潮。** 盖章 / 套印归位 / 压条，三选一做落点；其余动作都是铺垫。
5. **不用 opacity 淡入当主动效。** 淡入是“网页动画”的味道。需要出现就印出来、刷出来、升起来。
6. **时间全写绝对秒**，不用 GSAP 的相对排队；同一时间线里可以读前一个 helper 的返回值（落地时间）来接下一个。

## API（assets/riso.js）

```js
Riso.comp({ duration: 4.5, seed: 11 }, C => {
  // 1. 先排版（量尺寸）
  // 2. 再建时间轴
});
```

**排版工具**（在建时间轴之前调用）

| 函数 | 作用 |
|---|---|
| `Riso.text(el, '第一行\n第二行[重点]')` | 拆成 `.ln` 行 + `.ch` 字；`[ ]` 内的字带 `.em` |
| `Riso.fit(el, { width, max, min })` | 从 max 字号往下缩到最宽一行 ≤ width；缩到 min 仍放不下 → QA 报错 |
| `Riso.inkBox(el)` | 单行元素的**字形墨迹**框（#stage 坐标）——数字对齐用它 |
| `Riso.box(el)` | 元素盒子（#stage 坐标） |
| `Riso.halftone(canvas, { cell, density(u, v, t) })` | 返回 `draw(t)`；配合 `C.at(draw)` 做会动的网点 |

**时间轴 helper**（返回“落地时间”，可串联）

| 函数 | 参数（默认） |
|---|---|
| `C.camera({ push: .03, drift: 0 })` | 整条慢推 |
| `C.boil()` | 油墨颗粒呼吸 |
| `C.floor('#floor', { power: 2.1, max: .62, cell: 16 })` | 字幕床网点地层（开场 0.6s 从 70% 长满） |
| `C.print(sel, t, { dur: .7, from: 0, to, stagger })` | 网点显影；给 `to`（px）或元素带 `.tint` 时停在平网 |
| `C.register(t, { dx: 22, dy: -14 })` | 套印归位（整版 B 墨；版头色块固定不参与）。一条最多一次 |
| `C.hideUntil(sel, t)` | 元素在 t 之前不显示（print / count / draw 已自动调用） |
| `C.stamp(sel, t, { from: 1.55, rot: -5, dur: .17, shake: 5 })` | 盖章 |
| `C.rise(sel, t, { stagger: .034, dur: .62 })` | 逐字升起（需要先 `Riso.text`） |
| `C.roll(sel, t, { dur: .55, dir: 'right' })` | 滚筒刷开：right / left / up / down |
| `C.bar(sel, t, { dur: .6, axis: 'x' })` | 条形伸展（transform-origin 由 CSS 定） |
| `C.count(sel, t, { from: 0, to, dur: 1.1, fmt })` | 计数（值是时间的纯函数） |
| `C.draw(sel, t, { dur: .8, stagger })` | SVG 描线 |
| `C.pop(sel, t)` / `C.slide(sel, t, { x, y })` | 弹出 / 滑入 |
| `C.shake(t, a)` | 镜头震 |
| `C.at(f)` | 逐帧函数 `f(t)`（计数、画布都走这里） |
| `C.tl` | 原生 GSAP 时间线，复杂动作直接写 |

## 确定性（渲染器逐帧 seek，必须可复现）

- 不用 `setTimeout` / `requestAnimationFrame` / `Date.now()` / `Math.random()` 驱动画面。随机用 `C.rand()`（按 seed 可复现）。
- 计数器、画布、任何“随时间变”的东西放进 `C.at(t => …)`。
- 不发网络请求：字体在 `assets/fonts/`，GSAP 在 `assets/` 里，截图放项目 `assets/shots/`。


## 写新模板

复制最接近的模板改。检查单：

- [ ] 顶部注释写清楚：用于什么段落 / 画面是怎么讲故事的
- [ ] 只有 `DATA` 是给使用者改的；版面全部由 DATA 推算（`fit` / `inkBox` / `box`）
- [ ] 所有文字元素带 `.t`；有意叠印的加 `data-overprint`
- [ ] 第 0 帧干净（只有纸 + 地层）；2.5 秒内信息到位；有且只有一个高潮
- [ ] `render --still` + `qa` 零 error，再看一遍 `--at 0`、`--at 1` 两帧
