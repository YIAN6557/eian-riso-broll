#!/usr/bin/env node
// 重新生成 demo/（README 里的图）：按示例逐字稿的顺序渲 10 个模板 → 末帧总览 + 几条 GIF
//   node tools/build_demo.mjs
// 模板的默认 DATA 就是 examples/demo-script.md 的分镜，所以 demo 直接从 templates/ 渲。
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { SKILL_ROOT as ROOT, createProject, addTemplate } from '../scripts/lib/project.mjs';
import { contactSheet } from '../scripts/lib/media.mjs';

const ORDER = ['versus', 'title', 'number', 'compare', 'converge', 'network', 'focus', 'steps', 'shot', 'quote'];   // 逐字稿顺序
const GIFS = ['number', 'converge', 'compare', 'quote'];                                                        // README 顶部那一排
const DEMO = join(ROOT, 'demo'), TMP = join(mkdtempSync(join(tmpdir(), 'riso-demo-')), 'project');

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) { console.error('失败：' + cmd + ' ' + args.join(' ')); process.exit(1); }
};

createProject(TMP);
const id = n => `${String(ORDER.indexOf(n) + 1).padStart(2, '0')}-${n}`;
const comp = n => join(TMP, 'compositions', id(n) + '.html');
for (const n of ORDER) addTemplate(TMP, n, id(n));

// 1. 10 张末帧 → 5 列 × 2 行总览
run(process.execPath, [join(ROOT, 'scripts/render.mjs'), ...ORDER.map(comp), '--still']);
mkdirSync(DEMO, { recursive: true });
for (const f of readdirSync(DEMO)) if (/\.(gif|jpg|png)$/.test(f)) rmSync(join(DEMO, f));
await contactSheet(ORDER.map(n => join(TMP, 'plates', id(n) + '.png')), join(DEMO, 'sheet.jpg'), { cols: 5, w: 360, h: 640 });

// 2. 选几条渲成片 → 压成 GIF（15fps、360 宽、两遍调色板，只重画变化的区域）
run(process.execPath, [join(ROOT, 'scripts/render.mjs'), ...GIFS.map(comp), '--calm']);   // 纸纹不动、不推镜：GIF 小一个数量级
for (const n of GIFS) {
  const mp4 = join(TMP, 'renders', id(n) + '.mp4');
  run('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-filter_complex',
    'fps=15,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    join(DEMO, n + '.gif')]);
}
rmSync(dirname(TMP), { recursive: true, force: true });
console.log('✓ demo/ 已更新：sheet.jpg + ' + GIFS.map(n => n + '.gif').join(' '));
