// Parse a unified diff patch string into hunks and lines
// Returns: [{ header: string, lines: Array<{type:'add'|'del'|'ctx'|'meta', text:string}> }]
export function parseUnifiedPatch(patch) {
  if (!patch || typeof patch !== 'string') return [];
  const lines = patch.split(/\r?\n/);
  const hunks = [];
  let current = null;
  let oldLine = 0;
  let newLine = 0;
  for (let raw of lines) {
    if (raw.startsWith('@@')) {
      if (current) hunks.push(current);
      // parse header: @@ -a,b +c,d @@
      const m = raw.match(/@@\s+-(\d+),(\d+)\s+\+(\d+),(\d+)\s+@@/);
      if (m) {
        oldLine = parseInt(m[1], 10);
        newLine = parseInt(m[3], 10);
      } else {
        oldLine = 0; newLine = 0;
      }
      current = { header: raw, lines: [] };
      continue;
    }
    if (!current) {
      // Ignore lines before first hunk
      continue;
    }
    if (raw.startsWith('+')) {
      current.lines.push({ type: 'add', text: raw.slice(1), oldLine: null, newLine: newLine });
      newLine += 1;
    } else if (raw.startsWith('-')) {
      current.lines.push({ type: 'del', text: raw.slice(1), oldLine: oldLine, newLine: null });
      oldLine += 1;
    } else if (raw.startsWith(' ') || raw === '') {
      current.lines.push({ type: 'ctx', text: raw.slice(1), oldLine: oldLine, newLine: newLine });
      oldLine += 1; newLine += 1;
    } else if (raw.startsWith('\\')) {
      current.lines.push({ type: 'meta', text: raw, oldLine: null, newLine: null });
    } else if (raw.startsWith('---') || raw.startsWith('+++')) {
      current.lines.push({ type: 'meta', text: raw, oldLine: null, newLine: null });
    } else {
      current.lines.push({ type: 'ctx', text: raw, oldLine: null, newLine: null });
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

// Build side-by-side rows per hunk
// Returns: [{ header, rows: Array<{left:string,right:string, kind:'ctx'|'add'|'del'|'change'|'meta'}> }]
export function buildSideBySide(hunks) {
  const result = [];
  for (const h of hunks) {
    const rows = [];
    let leftBlock = [];
    let rightBlock = [];
    let leftNums = [];
    let rightNums = [];
    const flushBlocks = () => {
      const maxLen = Math.max(leftBlock.length, rightBlock.length);
      for (let i = 0; i < maxLen; i++) {
        const l = leftBlock[i] ?? '';
        const r = rightBlock[i] ?? '';
        const lNum = leftNums[i] ?? null;
        const rNum = rightNums[i] ?? null;
        let kind = 'change';
        if (l && !r) kind = 'del';
        else if (!l && r) kind = 'add';
        rows.push({ left: l, right: r, kind, leftLine: lNum, rightLine: rNum });
      }
      leftBlock = []; rightBlock = [];
      leftNums = []; rightNums = [];
    };
    for (const ln of h.lines) {
      if (ln.type === 'del') {
        leftBlock.push(ln.text);
        leftNums.push(ln.oldLine);
      } else if (ln.type === 'add') {
        rightBlock.push(ln.text);
        rightNums.push(ln.newLine);
      } else if (ln.type === 'ctx') {
        flushBlocks();
        rows.push({ left: ln.text, right: ln.text, kind: 'ctx', leftLine: ln.oldLine, rightLine: ln.newLine });
      } else if (ln.type === 'meta') {
        flushBlocks();
        rows.push({ left: ln.text, right: ln.text, kind: 'meta', leftLine: null, rightLine: null });
      }
    }
    flushBlocks();
    result.push({ header: h.header, rows });
  }
  return result;
}

export function copyToClipboard(text) {
  if (!text) return Promise.resolve();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // fallback
  return new Promise((resolve) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (_) { /* best-effort fallback copy may fail silently */ }
    document.body.removeChild(ta);
    resolve();
  });
}
