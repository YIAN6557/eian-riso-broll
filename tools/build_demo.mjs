#!/usr/bin/env node
// 重新生成 demo/（README 里的图）：按示例逐字稿的顺序渲 10 个模板 → 末帧总览 + 几条 GIF
//   node tools/build_demo.mjs
// 模板的默认 DATA 就是 examples/demo-script.md 的分镜，所以 demo 直接从 templates/ 渲。
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['versus', 'title', 'number', 'compare', 'converge', 'network', 'focus', 'steps', 'shot', 'quote'];   // 逐字稿顺序
const GIFS = ['number', 'converge', 'compare', 'quote'];                                                        // README 顶部那一排
const DEMO = join(ROOT, 'demo'), TMP = mkdtempSync(join(tmpdir(), 'riso-demo-'));

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) { console.error('失败：' + cmd + ' ' + args.join(' ')); process.exit(1); }
};

mkdirSync(join(TMP, 'compositions'), { recursive: true });
cpSync(join(ROOT, 'assets'), join(TMP, 'assets'), { recursive: true });
const comp = n => join(TMP, 'compositions', `${String(ORDER.indexOf(n) + 1).padStart(2, '0')}-${n}.html`);
for (const n of ORDER) cpSync(join(ROOT, 'templates', n + '.html'), comp(n));

// 1. 10 张末帧 → 5 列 × 2 行总览
run(process.execPath, [join(ROOT, 'scripts/render.mjs'), ...ORDER.map(comp), '--still']);
mkdirSync(DEMO, { recursive: true });
for (const f of readdirSync(DEMO)) if (/\.(gif|jpg|png)$/.test(f)) rmSync(join(DEMO, f));
const plates = ORDER.map(n => join(TMP, 'plates', `${String(ORDER.indexOf(n) + 1).padStart(2, '0')}-${n}.png`));
const W = 360, H = 640, G = 12;
const layout = plates.map((_, i) => `${(i % 5) * (W + G)}_${Math.floor(i / 5) * (H + G)}`).join('|');
run('ffmpeg', ['-v', 'error', '-y', ...plates.flatMap(p => ['-i', p]), '-filter_complex',
  plates.map((_, i) => `[${i}:v]scale=${W}:${H}:flags=lanczos[s${i}]`).join(';') + ';' + plates.map((_, i) => `[s${i}]`).join('') +
  `xstack=inputs=${plates.length}:layout=${layout}:fill=0x161616,pad=iw+${G * 2}:ih+${G * 2}:${G}:${G}:color=0x161616`,
  '-frames:v', '1', '-q:v', '3', join(DEMO, 'sheet.jpg')]);

// 2. 选几条渲成片 → 压成 GIF（15fps、360 宽、两遍调色板，只重画变化的区域）
run(process.execPath, [join(ROOT, 'scripts/render.mjs'), ...GIFS.map(comp), '--calm']);   // 纸纹不动、不推镜：GIF 小一个数量级
for (const n of GIFS) {
  const mp4 = join(TMP, 'renders', `${String(ORDER.indexOf(n) + 1).padStart(2, '0')}-${n}.mp4`);
  run('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-filter_complex',
    'fps=15,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    join(DEMO, n + '.gif')]);
}
rmSync(TMP, { recursive: true, force: true });
console.log('✓ demo/ 已更新：sheet.jpg + ' + GIFS.map(n => n + '.gif').join(' '));
