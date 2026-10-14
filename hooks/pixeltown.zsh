# Source from ~/.zshrc:   source ~/src/github.com/carmelal/pixeltown-at-work/hooks/pixeltown.zsh
# Commands matching PIXELTOWN_CHECKS are reported to the town as checks: geese land when one starts,
# leave when it passes, and menace the town when it fails. Harmless when the server is not running.

typeset -ga PIXELTOWN_CHECKS
PIXELTOWN_CHECKS=(
  'dev test:tests'
  'dev style:lint'
  'dev lint:lint'
  'dev typecheck:typecheck'
  'dev tc:typecheck'
  'bundle exec rspec:tests'
  'bundle exec rubocop:lint'
  'npm test:tests'
  'pnpm test:tests'
  'yarn test:tests'
  'go test:tests'
  'cargo test:tests'
  'pytest:tests'
  'gh run watch:ci'
  'gs ci:ci'
)

_pixeltown_post() { curl -s -m 1 -G "http://localhost:1337/event" --data-urlencode "type=$1" --data-urlencode "msg=$2" >/dev/null 2>&1 || true }

_pixeltown_preexec() {
  _PIXELTOWN_CHECK=""
  local entry prefix label
  for entry in $PIXELTOWN_CHECKS; do
    prefix="${entry%%:*}"; label="${entry##*:}"
    if [[ "$1" == "$prefix"* ]]; then _PIXELTOWN_CHECK="$label"; _pixeltown_post check_start "$label"; return; fi
  done
}
_pixeltown_precmd() {
  local rc=$?
  if [[ -n "$_PIXELTOWN_CHECK" ]]; then
    if (( rc == 0 )); then _pixeltown_post check_pass "$_PIXELTOWN_CHECK"; else _pixeltown_post check_fail "$_PIXELTOWN_CHECK"; fi
    _PIXELTOWN_CHECK=""
  fi
}
autoload -Uz add-zsh-hook
add-zsh-hook preexec _pixeltown_preexec
add-zsh-hook precmd _pixeltown_precmd
