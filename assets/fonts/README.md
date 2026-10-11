# 字体

随 skill 分发的字体，保证任何系统渲出来都一样。全部是 [SIL Open Font License 1.1](https://openfontlicense.org)，许可证原文在同目录的 `OFL-*.txt`。

| 文件 | 用途 | 来源 | 处理 |
|---|---|---|---|
| `riso-serif.woff2` | 标题（`.hd`） | Noto Serif SC（思源宋体），字重 900 | 只保留 GB2312 常用字 + 符号 |
| `riso-sans.woff2` | 标签、引子（`.lb`） | Noto Sans SC（思源黑体），字重 600 | 只保留 GB2312 常用字 + 符号 |
| `riso-num.woff2` | 数字（`.num`） | Oswald，字重 700 | 只保留拉丁字符 |
| `riso-mono.woff2` | 编号、版头（`.mono`） | JetBrains Mono，字重 500 | 只保留拉丁字符 |

上游文件来自 [google/fonts](https://github.com/google/fonts/tree/main/ofl)。裁剪属于 OFL 所说的修改版本，所以字体内部名称改成了 Riso Serif / Riso Sans / Riso Num / Riso Mono，和原版区分开。重新生成：`python3 tools/build_fonts.py <上游字体目录>`。

GB2312 之外的生僻字会回退到系统字体（宋体 / 苹方 / Noto）。
