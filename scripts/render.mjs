#!/usr/bin/env node
// 渲染器：逐帧 seek → 截图 → ffmpeg。成片只有画面，不带音轨。
//
//   node render.mjs compositions/01-x.html [更多.html]      → renders/<id>.mp4（H.264，无音轨）
//   node render.mjs compositions/*.html --still              → plates/<id>.png（末帧海报）+ plates/sheet.jpg
//   node render.mjs x.html --at 1.2                          → plates/<id>@1.2.png（任意时刻）
//   node render.mjs x.html --alpha                           → renders/<id>.mov（ProRes 4444 透明底，叠在口播上用）
//   选项：--draft（快速低码率）  --calm（纸纹不动、不推镜，只给压 GIF 用）  -o <输出路径>（只渲一条时可用）
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { once } from 'node:events';
import { launch } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const has = f => { const i = args.indexOf(f); if (i < 0) return false; args.splice(i, 1); return true; };
const val = f => { const i = args.indexOf(f); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const STILL = has('--still'), ALPHA = has('--alpha'), DRAFT = has('--draft'), CALM = has('--calm');
const AT = val('--at'), OUT = val('-o');
const files = args.map(f => resolve(f));
if (!files.length) { console.error('用法: render.mjs <composition.html> [...] [--still|--at t|--alpha|--draft] [-o out]'); process.exit(2); }
for (const f of files) if (!existsSync(f)) { console.error('找不到 ' + f); process.exit(2); }

const projectOf = f => basename(dirname(f)) === 'compositions' ? dirname(dirname(f)) : dirname(f);
const run = (cmd, a) => new Promise((res, rej) => {
  const p = spawn(cmd, a, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', d => err += d);
  p.on('close', c => c ? rej(new Error(cmd + ' 失败:\n' + err.slice(-2000))) : res());
});

const chrome = await launch();
const stills = [];
try {
  for (const file of files) {
    const t0 = Date.now();
    const page = await chrome.open(file, { query: '?render' + (ALPHA ? '&alpha' : '') + (CALM ? '&calm' : ''), alpha: ALPHA });
    const m = await page.meta();
    const proj = projectOf(file);

    if (STILL || AT != null) {
      const at = AT != null ? +AT : 'end';
      const out = OUT || join(proj, 'plates', m.id + (AT != null ? '@' + AT : '') + '.png');
      mkdirSync(dirname(out), { recursive: true });
      await page.seek(at);
      writeFileSync(out, await page.shot('png'));
      stills.push(out);
      console.log(`✓ ${m.id}  样帧 → ${out}`);
      await page.close();
      continue;
    }

    const out = OUT || join(proj, 'renders', m.id + (ALPHA ? '.mov' : '.mp4'));
    mkdirSync(dirname(out), { recursive: true });
    const N = Math.round(m.duration * m.fps), D = (N / m.fps).toFixed(3);

    const venc = ALPHA
      ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
      : ['-c:v', 'libx264', '-preset', DRAFT ? 'veryfast' : 'medium', '-crf', DRAFT ? '24' : '18', '-maxrate', '24M', '-bufsize', '48M',
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(m.fps), '-i', '-', '-an', ...venc, '-r', String(m.fps), '-t', D, out],
      { stdio: ['pipe', 'ignore', 'pipe'] });
    let ferr = ''; ff.stderr.on('data', d => ferr += d);
    const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg 失败:\n' + ferr.slice(-2000))) : res()));

    for (let i = 0; i < N; i++) {
      await page.seek(i / m.fps);
      const buf = await page.shot(ALPHA ? 'png' : 'jpeg');
      if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
      if (process.stdout.isTTY) process.stdout.write(`\r  ${m.id}  ${i + 1}/${N}`);
    }
    ff.stdin.end();
    await done;
    await page.close();
    if (process.stdout.isTTY) process.stdout.write('\r');
    console.log(`✓ ${m.id}  ${D}s · ${N} 帧 · ${((Date.now() - t0) / 1000).toFixed(1)}s → ${out}`);
  }

  // 多张样帧 → 自动拼一张 contact sheet（每行 4 张）
  if (stills.length > 1 && !OUT) {
    const cols = Math.min(stills.length, 4), n = cols * Math.ceil(stills.length / cols);
    const sheet = join(dirname(stills[0]), 'sheet.jpg');
    const fill = Array.from({ length: n - stills.length }, () => ['-f', 'lavfi', '-i', 'color=c=0x161616:s=432x768:d=1']).flat();
    const layout = Array.from({ length: n }, (_, i) => `${(i % cols) * 444}_${Math.floor(i / cols) * 780}`).join('|');
    const fc = Array.from({ length: n }, (_, i) => i < stills.length ? `[${i}:v]scale=432:768[s${i}]` : `[${i}:v]null[s${i}]`).join(';') + ';' +
      Array.from({ length: n }, (_, i) => `[s${i}]`).join('') + `xstack=inputs=${n}:layout=${layout}:fill=0x161616,pad=iw+24:ih+24:12:12:color=0x161616`;
    await run('ffmpeg', ['-v', 'error', '-y', ...stills.flatMap(s => ['-i', s]), ...fill, '-filter_complex', fc, '-frames:v', '1', '-q:v', '3', sheet]);
    console.log(`✓ contact sheet → ${sheet}`);
  }
} finally {
  await chrome.close();
}
