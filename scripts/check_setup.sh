#!/bin/bash
# 环境自检：Node ≥ 22（自带 WebSocket）、Chrome/Chromium、ffmpeg/ffprobe、字体、skill 资产
set -uo pipefail
PASS=0; FAIL=0; WARN=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  $1"; WARN=$((WARN+1)); }
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
echo "eian-riso-broll 环境自检"; echo

if command -v node >/dev/null 2>&1; then
  M=$(node -v | sed 's/^v//' | cut -d. -f1)
  [ "$M" -ge 22 ] && ok "node $(node -v)" || bad "node $(node -v) 太旧：需要 ≥ 22（渲染器用 Node 自带的 WebSocket）"
else bad "没有 node（需要 ≥ 22）"; fi

# 不只找到路径，还真的启动一次：沙箱、缺库这类问题只有启动时才会暴露
if CH=$(node -e "import('$SKILL/scripts/lib/chrome.mjs').then(async m=>{const p=m.findChrome();const c=await m.launch();await c.close();console.log(p)}).catch(e=>{console.error(e.message);process.exit(1)})" 2>&1); then
  ok "Chrome: $CH"
else bad "Chrome 不可用（可用环境变量 CHROME=<路径> 指定）："; echo "$CH" | sed 's/^/       /'; fi

command -v ffmpeg  >/dev/null && ok "ffmpeg $(ffmpeg -version | head -1 | awk '{print $3}')" || bad "没有 ffmpeg"
command -v ffprobe >/dev/null && ok "ffprobe" || bad "没有 ffprobe"

# 字体随 skill 分发（assets/fonts/），不依赖系统字体
for f in riso-serif riso-sans riso-num riso-mono; do [ -f "$SKILL/assets/fonts/$f.woff2" ] && ok "字体 $f" || bad "缺 assets/fonts/$f.woff2"; done

for f in riso.css riso.js gsap.min.js; do [ -f "$SKILL/assets/$f" ] && ok "assets/$f" || bad "缺 assets/$f"; done

echo
if [ $FAIL -ne 0 ]; then echo "$FAIL 项未通过。"; exit 1; fi
[ $WARN -gt 0 ] && echo "通过 $PASS 项，提醒 $WARN 项。" || echo "全部通过（$PASS 项）。"
