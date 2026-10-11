// 极简 headless Chrome 驱动（CDP over WebSocket，Node ≥ 22 自带 WebSocket，零依赖）
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function findChrome() {
  if (process.env.CHROME) {
    if (!existsSync(process.env.CHROME)) throw new Error('环境变量 CHROME 指向的文件不存在：' + process.env.CHROME);
    return process.env.CHROME;
  }
  const cands = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ...windowsChromes(),
    ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(n => {
      if (process.platform === 'win32') return null;
      try { return execFileSync('which', [n], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
    }),
    ...playwrightChromes(),
  ];
  const hit = cands.find(c => c && existsSync(c));
  if (!hit) throw new Error('找不到 Chrome / Chromium。设置环境变量 CHROME=<可执行文件路径>');
  return hit;
}

// Windows：Chrome 的几个默认安装位置；Edge 也是 Chromium 内核，放最后兜底
function windowsChromes() {
  if (process.platform !== 'win32') return [];
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  return [...roots.map(r => join(r, 'Google/Chrome/Application/chrome.exe')), ...roots.map(r => join(r, 'Microsoft/Edge/Application/msedge.exe'))];
}

// Playwright 下载过的 Chromium（装过 Playwright 的机器、CI 镜像里常见），版本新的优先
function playwrightChromes() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache/ms-playwright'), join(homedir(), 'Library/Caches/ms-playwright'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright')].filter(Boolean);
  const bins = ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-win64/chrome.exe', 'chrome-win/chrome.exe'];
  const out = [];
  for (const r of roots) {
    let dirs = [];
    try { dirs = readdirSync(r).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => b.split('-')[1] - a.split('-')[1]); } catch { continue; }
    for (const d of dirs) for (const b of bins) out.push(join(r, d, b));
  }
  return out;
}

export async function launch({ width = 1080, height = 1920 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'riso-chrome-'));
  const proc = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--force-device-scale-factor=1', `--window-size=${width},${height}`,
    '--force-color-profile=srgb', '--allow-file-access-from-files', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    // root 身份（Docker / CI / 云端容器）下 Chrome 拒绝在沙箱里启动；普通用户不加
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  // 启动失败时把 Chrome 自己的报错带出来，否则只剩一个退出码
  let buf = '';
  const tail = () => buf.trim().split('\n').slice(-8).join('\n');
  const wsUrl = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('Chrome 启动超时（20s）\n' + tail())), 20000);
    proc.on('error', e => { clearTimeout(to); rej(new Error('Chrome 无法启动：' + e.message)); });
    proc.stderr.on('data', d => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(to); res(m[1]); }
    });
    proc.on('exit', c => { clearTimeout(to); rej(new Error(`Chrome 退出 code=${c}\n${tail()}`)); });
  });
  proc.stderr.resume();

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
