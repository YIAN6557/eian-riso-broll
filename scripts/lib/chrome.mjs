// 极简 headless Chrome 驱动（CDP over WebSocket，Node ≥ 22 自带 WebSocket，零依赖）
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function findChrome() {
  const cands = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(n => {
      try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return null; }
    }),
  ];
  const hit = cands.find(c => c && existsSync(c));
  if (!hit) throw new Error('找不到 Chrome / Chromium。设置环境变量 CHROME=<可执行文件路径>');
  return hit;
}

export async function launch({ width = 1080, height = 1920 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'riso-chrome-'));
  const proc = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--force-device-scale-factor=1', `--window-size=${width},${height}`,
    '--force-color-profile=srgb', '--allow-file-access-from-files', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    const to = setTimeout(() => rej(new Error('Chrome 启动超时')), 20000);
    proc.stderr.on('data', d => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(to); res(m[1]); }
    });
    proc.on('exit', c => rej(new Error('Chrome 退出 code=' + c)));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map(), listeners = new Set();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else listeners.forEach(f => f(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

  async function open(file, { query = '', alpha = false } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: sid } = await send('Target.attachToTarget', { targetId, flatten: true });
    const errors = [];
    listeners.add(m => {
      if (m.sessionId !== sid) return;
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    });
    await send('Page.enable', {}, sid);
    await send('Runtime.enable', {}, sid);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sid);
    if (alpha) await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, sid);
    const loaded = new Promise(r => listeners.add(m => { if (m.sessionId === sid && m.method === 'Page.loadEventFired') r(); }));
    await send('Page.navigate', { url: pathToFileURL(file).href + query }, sid);
    await loaded;

    const evaluate = async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid);
      if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + errors.join('\n'));
      return r.result.value;
    };
    const ok = await evaluate(`new Promise(r => { const w = () => window.__riso ? r(true) : setTimeout(w, 30); w(); setTimeout(() => r(false), 8000); })`);
    if (!ok) throw new Error('页面没有调用 Riso.comp()（没有 window.__riso）\n' + errors.join('\n'));
    await evaluate('window.__riso.ready');
    if (errors.length) throw new Error('页面脚本报错：\n' + errors.join('\n'));

    return {
      evaluate,
      meta: () => evaluate('window.__riso.meta()'),
      seek: t => evaluate(`window.__riso.seek(${JSON.stringify(t)})`),
      shot: async (format = 'png') => Buffer.from((await send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality: 95 } : {}), optimizeForSpeed: true }, sid)).data, 'base64'),
      close: () => send('Target.closeTarget', { targetId }),
    };
  }

  async function close() {
    await Promise.race([send('Browser.close').catch(() => { }), new Promise(r => setTimeout(r, 800))]);
    ws.close(); proc.kill('SIGKILL');
    try { rmSync(dir, { recursive: true, force: true }); } catch { }
  }
  return { open, close };
}
