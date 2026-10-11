// ffmpeg / ffprobe：跑命令、拼 contact sheet、读成片参数
import { spawn, spawnSync } from 'node:child_process';

export const run = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', d => err += d);
  p.on('error', e => rej(new Error(`${cmd} 无法启动：${e.message}`)));
  p.on('close', c => c ? rej(new Error(`${cmd} 失败:\n${err.slice(-2000)}`)) : res());
});

// 多张竖图拼成一张网格，空位补深灰
export function contactSheet(images, out, { cols = 4, w = 432, h = 768, gap = 12, bg = '0x161616', quality = 3 } = {}) {
  cols = Math.min(cols, images.length);
  const n = cols * Math.ceil(images.length / cols);
  const fill = Array.from({ length: n - images.length }, () => ['-f', 'lavfi', '-i', `color=c=${bg}:s=${w}x${h}:d=1`]).flat();
  const layout = Array.from({ length: n }, (_, i) => `${(i % cols) * (w + gap)}_${Math.floor(i / cols) * (h + gap)}`).join('|');
  const fc = Array.from({ length: n }, (_, i) => i < images.length ? `[${i}:v]scale=${w}:${h}:flags=lanczos[s${i}]` : `[${i}:v]null[s${i}]`).join(';') + ';' +
    Array.from({ length: n }, (_, i) => `[s${i}]`).join('') +
    `xstack=inputs=${n}:layout=${layout}:fill=${bg},pad=iw+${gap * 2}:ih+${gap * 2}:${gap}:${gap}:color=${bg}`;
  return run('ffmpeg', ['-v', 'error', '-y', ...images.flatMap(s => ['-i', s]), ...fill, '-filter_complex', fc, '-frames:v', '1', '-q:v', String(quality), out]);
}

// 成片的时长与尺寸；读不到时返回 null
export function probe(file) {
  const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', file], { encoding: 'utf8' });
  try {
    const j = JSON.parse(p.stdout), v = j.streams[0];
    return { duration: +j.format.duration, width: v.width, height: v.height };
  } catch { return null; }
}
