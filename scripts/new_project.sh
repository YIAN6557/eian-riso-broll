#!/bin/bash
# 新建项目：new_project.sh <项目名>
# 落在 ${RISO_PROJECTS_DIR:-~/eian-riso-broll-projects}/<项目名>/；assets 整份拷入（项目自包含，换机器也能渲）
set -euo pipefail
NAME="${1:?用法: new_project.sh <项目名，如 2026-10-07-知识库>}"
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
PROJ="${RISO_PROJECTS_DIR:-$HOME/eian-riso-broll-projects}/$NAME"
[ -e "$PROJ" ] && { echo "已存在: $PROJ" >&2; exit 1; }
mkdir -p "$PROJ"/{compositions,plates,renders,qa,assets/shots}
cp -R "$SKILL/assets/." "$PROJ/assets/"
cat > "$PROJ/STORYBOARD.md" <<'MD'
# 分镜表

| # | 原话落点 | 模板 | 色本 | 时长 | 屏幕文字（只用原话） | 截图锚点 |
|---|---|---|---|---|---|---|

落选段：
MD
echo "$PROJ"
