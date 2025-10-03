// Parse a unified diff patch string into hunks and lines
// Returns: [{ header: string, lines: Array<{type:'add'|'del'|'ctx'|'meta', text:string}> }]
export function parseUnifiedPatch(patch) {
  if (!patch || typeof patch !== 'string') return [];
  const lines = patch.split(/\r?\n/);
  const hunks = [];
  let current = null;
  for (let raw of lines) {
    if (raw.startsWith('@@')) {
      if (current) hunks.push(current);
      current = { header: raw, lines: [] };
      continue;
    }
    if (!current) {
      // Ignore lines before first hunk
      continue;
    }
    if (raw.startsWith('+')) {
      current.lines.push({ type: 'add', text: raw.slice(1) });
    } else if (raw.startsWith('-')) {
      current.lines.push({ type: 'del', text: raw.slice(1) });
    } else if (raw.startsWith(' ') || raw === '') {
      current.lines.push({ type: 'ctx', text: raw.slice(1) });
    } else if (raw.startsWith('\\')) {
      // meta like "\\ No newline at end of file"
      current.lines.push({ type: 'meta', text: raw });
    } else if (raw.startsWith('---') || raw.startsWith('+++')) {
      // file markers inside hunk - treat as meta
      current.lines.push({ type: 'meta', text: raw });
    } else {
      // unknown -> treat as context
      current.lines.push({ type: 'ctx', text: raw });
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
    const flushBlocks = () => {
      const maxLen = Math.max(leftBlock.length, rightBlock.length);
      for (let i = 0; i < maxLen; i++) {
        const l = leftBlock[i] ?? '';
        const r = rightBlock[i] ?? '';
        let kind = 'change';
        if (l && !r) kind = 'del';
        else if (!l && r) kind = 'add';
        rows.push({ left: l, right: r, kind });
      }
      leftBlock = [];
      rightBlock = [];
    };
    for (const ln of h.lines) {
      if (ln.type === 'del') {
        leftBlock.push(ln.text);
      } else if (ln.type === 'add') {
        rightBlock.push(ln.text);
      } else if (ln.type === 'ctx') {
        flushBlocks();
        rows.push({ left: ln.text, right: ln.text, kind: 'ctx' });
      } else if (ln.type === 'meta') {
        flushBlocks();
        rows.push({ left: ln.text, right: ln.text, kind: 'meta' });
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
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    resolve();
  });
}

