// 驗證 artists/**/*.json：node validate.mjs（CI 與投稿前都跑）。
// shortcut: 規則複製自主站 src/public-export.ts，兩邊要同步改；日後可抽成共用套件。
import fs from 'fs'; import path from 'path';
const SECRET = /^(token|key|secret|password|pass|auth|session|sid|access_token|api_key|signature|sig)$/i;
const PRIVATE = /^(localhost|.*\.local|.*\.internal)$/i;
function urlErr(raw) {
  let u; try { u = new URL(raw); } catch { return '不是有效網址'; }
  if (!['http:', 'https:'].includes(u.protocol)) return '只允許 http/https';
  if (u.username || u.password) return '網址不可含帳密';
  const h = u.hostname;
  if (PRIVATE.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return '不可為內網或 IP';
  if (!h.includes('.')) return '網域不完整';
  for (const k of u.searchParams.keys()) if (SECRET.test(k)) return `含疑似密鑰參數 ${k}`;
  return null;
}
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : p.endsWith('.json') && files.push(p); } })('artists');
let bad = 0; const ids = new Set();
for (const f of files) {
  const errs = [];
  let a; try { a = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { errs.push('JSON 格式錯誤'); }
  if (a) {
    if (!/^[A-Za-z0-9_-]+$/.test(a.id ?? '')) errs.push('id 格式錯誤');
    if (ids.has(a.id)) errs.push('id 重複'); ids.add(a.id);
    if (typeof a.name !== 'string' || !a.name.trim() || a.name.length > 200) errs.push('名稱為空或過長');
    if (!Array.isArray(a.accounts) || a.accounts.length === 0) errs.push('至少需要一個連結');
    const seen = new Set();
    for (const x of a.accounts ?? []) {
      const e = urlErr(x.url); if (e) errs.push(`${x.url}: ${e}`);
      if (!['alive', 'dead'].includes(x.status)) errs.push(`${x.url}: 狀態只能是 alive 或 dead`);
      if (seen.has(x.url)) errs.push(`${x.url}: 重複`); seen.add(x.url);
    }
  }
  if (errs.length) { bad++; console.error(`${f}\n  - ${errs.join('\n  - ')}`); }
}
console.log(`檢查 ${files.length} 個檔案，${bad} 個有問題`);
process.exit(bad ? 1 : 0);
