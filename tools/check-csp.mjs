import fs from 'node:fs';

const pages = [
  'index.html',
  'student-portal.html',
  'admin/school-admin.html',
  'admin/super-admin.html',
  'manual.html',
  'school-admin.html',
  'super-admin.html',
];
const generatedScripts = fs.readdirSync('assets/js/pages')
  .filter((file) => file.endsWith('.js'))
  .map((file) => `assets/js/pages/${file}`);
const failures = [];
let actionCount = 0;

function fail(message) {
  failures.push(message);
}

for (const file of pages) {
  const source = fs.readFileSync(file, 'utf8');
  const inlineScripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/i.test(match[1]));
  if (inlineScripts.length) fail(`${file} contains ${inlineScripts.length} inline script block(s)`);
  if (/\s(?:onclick|onchange|oninput|onkeydown|onerror)\s*=/i.test(source)) {
    fail(`${file} contains an inline event attribute`);
  }
  const policyTag = source.match(/<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
  const policy = policyTag && policyTag[0].match(/content=(["'])([\s\S]*?)\1/i);
  if (!policy) {
    fail(`${file} has no CSP meta policy`);
  } else {
    const scriptPolicy = policy[2].match(/script-src\s+([^;]+)/i);
    if (!scriptPolicy || scriptPolicy[1].includes("'unsafe-inline'")) {
      fail(`${file} allows inline scripts`);
    }
    if (!/script-src-attr\s+'none'/i.test(policy[2])) {
      fail(`${file} does not explicitly block script attributes`);
    }
  }
}

const serverPolicy = fs.readFileSync('.htaccess', 'utf8');
if (/script-src\s+[^;]*'unsafe-inline'/i.test(serverPolicy)) fail('.htaccess allows inline scripts');
if (!/script-src-attr\s+'none'/i.test(serverPolicy)) fail('.htaccess does not block script attributes');

const dispatcher = fs.readFileSync('assets/js/csp-event-dispatcher.js', 'utf8');
const allowlistBlock = dispatcher.match(/const allowedActions\s*=\s*new Set\(\[([\s\S]*?)\]\);/);
if (!allowlistBlock) fail('Could not read the CSP action allowlist');
const allowed = new Set(allowlistBlock ? [...allowlistBlock[1].matchAll(/'([A-Za-z_$][\w$]*)'/g)].map((match) => match[1]) : []);

function outsideQuotedText(source) {
  let output = '';
  let quote = '';
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      output += ' ';
      escaped = false;
      continue;
    }
    if (quote && character === '\\') {
      output += ' ';
      escaped = true;
      continue;
    }
    if (quote) {
      output += ' ';
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      output += ' ';
      continue;
    }
    output += character;
  }
  return output;
}

for (const file of [...pages, ...generatedScripts]) {
  const source = fs.readFileSync(file, 'utf8');
  for (const handler of source.matchAll(/data-qa-on(?:click|change|input|keydown|error)\s*=\s*(["'])([\s\S]*?)\1/g)) {
    actionCount += 1;
    const executable = outsideQuotedText(handler[2]);
    for (const call of executable.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = call[1];
      const previous = executable[call.index - 1] || '';
      if (name === 'if' || previous === '.') continue;
      if (!allowed.has(name)) fail(`${file} uses non-allowlisted action ${name}`);
    }
  }
}

if (!fs.readFileSync('assets/js/template-sanitizer.js', 'utf8').includes("name.startsWith('data-qa-on')")) {
  fail('Template sanitizer does not strip delegated action attributes');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`CSP check passed: ${pages.length} pages, ${generatedScripts.length} external page scripts, ${actionCount} delegated actions.`);
