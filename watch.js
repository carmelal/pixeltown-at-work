// Watches local repos and turns what you are doing into town events.
//   - git activity: tails .git/logs/HEAD in every repo under the roots → commit / checkout / pull / merge / rebase / reset
//   - editing:      recursive fs.watch on each root, debounced per repo → editing <repo>, then idle when it goes quiet
// Nothing is installed into any repo; it only reads.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const IGNORE = /\/(\.git|node_modules|tmp|\.cache|dist|build|target|\.next|coverage)(\/|$)/;

export function startWatching(roots, emit) {
  roots = roots.map(r => r.replace(/^~/, os.homedir())).filter(r => fs.existsSync(r));
  const repos = new Map();                       // repoRoot -> { name, logFile, lastTs, editTimer, lastEditEmit }

  function headLog(repoRoot) {                   // handles plain repos and worktrees (.git is a file pointing elsewhere)
    const dotgit = path.join(repoRoot, ".git");
    try {
      const st = fs.statSync(dotgit);
      if (st.isDirectory()) return path.join(dotgit, "logs", "HEAD");
      const m = fs.readFileSync(dotgit, "utf8").match(/gitdir:\s*(.+)/);
      if (m) return path.join(path.resolve(repoRoot, m[1].trim()), "logs", "HEAD");
    } catch {}
    return null;
  }

  function addRepo(repoRoot) {
    if (repos.has(repoRoot)) return;
    const logFile = headLog(repoRoot);
    if (!logFile || !fs.existsSync(logFile)) return;
    const repo = { name: path.basename(repoRoot), logFile, lastTs: lastEntry(logFile)?.ts ?? 0, editTimer: null, lastEditEmit: 0, idleTimer: null };
    repos.set(repoRoot, repo);
    fs.watchFile(logFile, { interval: 1500 }, () => onGitLog(repo));
  }

  function lastEntry(logFile) {
    try {
      const lines = fs.readFileSync(logFile, "utf8").trimEnd().split("\n");
      const line = lines.at(-1); if (!line) return null;
      // "<old> <new> Name <email> <ts> <tz>\t<message>"
      const m = line.match(/^\S+ \S+ .*? <[^>]*> (\d+) [+-]\d{4}\t(.*)$/);
      return m ? { ts: Number(m[1]), msg: m[2] } : null;
    } catch { return null; }
  }

  function onGitLog(repo) {
    const e = lastEntry(repo.logFile);
    if (!e || e.ts <= repo.lastTs) return;
    repo.lastTs = e.ts;
    const [kind, rest = ""] = e.msg.split(/:\s(.*)/s);
    const k = kind.toLowerCase();
    if (k.startsWith("commit")) emit({ type: "commit", msg: `${repo.name}: ${rest}` });
    else if (k.startsWith("checkout")) { const to = rest.match(/to (.+)$/)?.[1] ?? rest; emit({ type: "checkout", msg: `${repo.name} → ${to}` }); }
    else if (k.startsWith("pull")) emit({ type: "pull", msg: repo.name });
    else if (k.startsWith("merge")) emit({ type: "merge", msg: `${repo.name}: ${rest}` });
    else if (k.startsWith("rebase")) emit({ type: "rebase", msg: repo.name });
    else if (k.startsWith("reset")) emit({ type: "reset", msg: repo.name });
    // pushes do not touch the reflog; a post-push notification would need a hook or a remote watch
  }

  function onEdit(repoRoot, file) {
    const repo = repos.get(repoRoot); if (!repo) return;
    const now = Date.now();
    if (now - repo.lastEditEmit > 15000) { repo.lastEditEmit = now; emit({ type: "editing", msg: repo.name }); }
    clearTimeout(repo.idleTimer);
    repo.idleTimer = setTimeout(() => emit({ type: "idle", msg: repo.name }), 90000);
  }

  for (const root of roots) {
    for (const d of fs.readdirSync(root, { withFileTypes: true })) if (d.isDirectory()) addRepo(path.join(root, d.name));
    try {
      fs.watch(root, { recursive: true }, (_evt, rel) => {
        if (!rel) return;
        const full = path.join(root, rel);
        if (IGNORE.test("/" + rel)) { if (/\/\.git\/logs\/HEAD$/.test("/" + rel)) { /* handled by watchFile */ } return; }
        const repoRoot = path.join(root, rel.split(path.sep)[0]);
        if (!repos.has(repoRoot)) addRepo(repoRoot);   // a freshly cloned repo
        onEdit(repoRoot, full);
      });
    } catch (err) { console.warn("watch failed for", root, err.message); }
  }
  console.log(`watching ${repos.size} repos under ${roots.join(", ")}`);
  return repos;
}
