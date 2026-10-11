#!/usr/bin/env python3
"""从上游开源字体生成 assets/fonts/ 里的 woff2（维护者用；使用 skill 不需要跑）。

    pip install fonttools brotli
    python3 tools/build_fonts.py <上游字体目录>

上游字体全部来自 https://github.com/google/fonts/tree/main/ofl （SIL OFL 1.1）：
    notoserifsc/NotoSerifSC[wght].ttf   notosanssc/NotoSansSC[wght].ttf
    oswald/Oswald[wght].ttf             jetbrainsmono/JetBrainsMono[wght].ttf
把这几个文件按原名（去掉 [wght]，如 NotoSerifSC.ttf）放进 <上游字体目录>。

做了三件事：可变字体固定到用到的字重 → 裁剪字符集 → 输出 woff2。
裁剪改动了字体，按 OFL 要求改了字体内部名称（Riso Serif 等），避免和原版混淆。
中文字符集 = GB2312 全部 6763 个汉字 + 全角符号；不在里面的生僻字会回退到系统字体。
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'fonts'

# 输出文件名、上游文件、字重、字符集、内部名称
FONTS = [
    ('riso-serif.woff2', 'NotoSerifSC.ttf', 900, 'cjk', 'Riso Serif'),   # 标题（替代宋体 Black）
    ('riso-sans.woff2', 'NotoSansSC.ttf', 600, 'cjk', 'Riso Sans'),      # 标签、引子（替代苹方 Semibold）
    ('riso-num.woff2', 'Oswald.ttf', 700, 'latin', 'Riso Num'),          # 数字（替代 DIN Condensed）
    ('riso-mono.woff2', 'JetBrainsMono.ttf', 500, 'latin', 'Riso Mono'), # 编号、版头（替代 Menlo）
]


def charset(kind):
    cs = set(range(0x20, 0x7F)) | set(range(0xA0, 0x180))                       # ASCII + 拉丁补充
    cs |= set(range(0x2010, 0x2070)) | {0x20AC, 0x2116, 0x2122, 0x2190, 0x2192, 0x2191, 0x2193, 0x00D7, 0x00F7}
    if kind == 'cjk':
        for b1 in range(0xA1, 0xF8):                                             # GB2312 全表（符号区 + 一二级汉字）
            for b2 in range(0xA1, 0xFF):
                try:
                    cs.add(ord(bytes([b1, b2]).decode('gb2312')))
                except UnicodeDecodeError:
                    pass
        cs |= set(range(0x3000, 0x3040)) | set(range(0xFF01, 0xFF5F))           # CJK 标点 + 全角
    return cs


def rename(font, family):
    name = font['name']
    ps = family.replace(' ', '')
    for rec in list(name.names):
        if rec.nameID in (1, 4, 16, 21):
            rec.string = family
        elif rec.nameID == 6:
            rec.string = ps
        elif rec.nameID == 3:
            rec.string = ps + '-subset'
        elif rec.nameID in (2, 17, 22):
            rec.string = 'Regular'
    name.names = [r for r in name.names if r.nameID not in (16, 17, 21, 22, 25)]


def build(src_dir):
    OUT.mkdir(parents=True, exist_ok=True)
    for out, src, weight, kind, family in FONTS:
        font = TTFont(Path(src_dir) / src)
        if 'fvar' in font:
            font = instancer.instantiateVariableFont(font, {'wght': weight})
        opts = subset.Options()
        opts.layout_features = ['*']
        opts.hinting = False
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.flavor = 'woff2'
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=charset(kind))
        sub.subset(font)
        rename(font, family)
        font.flavor = 'woff2'
        font.save(OUT / out)
        print(f'{out:20s} {(OUT / out).stat().st_size / 1e6:5.2f} MB  ← {src} @ {weight}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(sys.argv[1])
