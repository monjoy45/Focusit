import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const errors = [];
const fail = (m) => errors.push(m);
const dist = 'dist';
let m;
try { m = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')); } catch (e) { console.error('manifest.json unreadable:', e.message); process.exit(1); }

if (m.manifest_version !== 3) fail('manifest_version must be 3');
for (const k of ['name', 'version', 'description']) if (!m[k]) fail(`missing ${k}`);

const ALLOWED_PERMISSIONS = ['storage', 'alarms'];
for (const p of m.permissions ?? []) if (!ALLOWED_PERMISSIONS.includes(p)) fail(`unexpected permission: ${p}`);
// host_permissions are intentionally scoped to exactly the two supported sites (needed since
// Phase 10 to read/redirect a tab's URL for the post-session lockout) -- never broader, and
// never the blanket "tabs" permission, which would also expose every other open tab's URL.
const ALLOWED_HOST_PERMISSIONS = ['https://www.youtube.com/*', 'https://m.youtube.com/*', 'https://www.instagram.com/*'];
for (const p of m.host_permissions ?? []) if (!ALLOWED_HOST_PERMISSIONS.includes(p)) fail(`unexpected host permission: ${p}`);
if (m.permissions?.includes('tabs')) fail('the blanket "tabs" permission must not be used; host_permissions scoped to the two supported sites covers everything this extension needs');
if (m.optional_permissions?.length || m.optional_host_permissions?.length) fail('no optional permissions expected');
if (m.content_security_policy) fail('custom CSP not expected');
for (const cs of m.content_scripts ?? []) for (const pat of cs.matches) if (!/^https:\/\/(www|m)\.(youtube|instagram)\.com\/\*$/.test(pat)) fail(`unexpected match pattern: ${pat}`);

const refs = new Set([
  m.background?.service_worker, m.action?.default_popup, m.options_ui?.page,
  ...Object.values(m.icons ?? {}), ...Object.values(m.action?.default_icon ?? {}),
  ...(m.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
].filter(Boolean));
for (const r of refs) if (!existsSync(join(dist, r))) fail(`referenced file missing: ${r}`);

// HTML pages must load only local scripts (MV3 forbids remote code).
for (const html of ['popup.html', 'options.html']) {
  const src = readFileSync(join(dist, html), 'utf8');
  for (const s of src.matchAll(/<script[^>]*src="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(s[1])) fail(`${html}: remote script ${s[1]}`);
    else if (!existsSync(join(dist, s[1]))) fail(`${html}: missing script ${s[1]}`);
  }
  if (/<script(?![^>]*src=)/.test(src)) fail(`${html}: inline script`);
}

// No unsafe dynamic code or network calls in bundles.
for (const f of readdirSync(dist).filter((f) => f.endsWith('.js'))) {
  const code = readFileSync(join(dist, f), 'utf8');
  if (/\beval\s*\(|new Function\s*\(/.test(code)) fail(`${f}: eval/new Function`);
  if (/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(code)) fail(`${f}: network API used`);
}

if (errors.length) { console.error('VALIDATION FAILED\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`OK: manifest v3, permissions [${(m.permissions ?? []).join(', ')}], host_permissions [${(m.host_permissions ?? []).join(', ')}], ${refs.size} referenced files present, no remote/unsafe code.`);
