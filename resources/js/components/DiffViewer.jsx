import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconClipboard } from '@tabler/icons-react';
import { parseUnifiedPatch, buildSideBySide, copyToClipboard } from '@/utils/patch';

const LINE_HEIGHT = 20; // px per row approx
const BUFFER_ROWS = 50; // render buffer around viewport

export default function DiffViewer({ filename, patch, mode = 'unified', onCopy, additions = 0, deletions = 0, colorful = false, height = 360 }) {
  const containerRef = useRef(null);
  const [viewportH, setViewportH] = useState(320);
  const [scrollTop, setScrollTop] = useState(0);

  const hunks = useMemo(() => parseUnifiedPatch(patch || ''), [patch]);
  const sbs = useMemo(() => (mode === 'side-by-side' ? buildSideBySide(hunks) : []), [mode, hunks]);

  // Flatten rows for virtualization
  const unifiedRows = useMemo(() => {
    if (mode !== 'unified') return [];
    const rows = [];
    for (const h of hunks) {
      rows.push({ kind: 'header', text: h.header });
      for (const ln of h.lines) {
         const prefix = ln.type === 'add' ? '+' : ln.type === 'del' ? '-' : ' ';
         rows.push({ kind: 'line', type: ln.type, text: prefix + ln.text });
      }
    }
    return rows;
  }, [mode, hunks]);

  const sbsRows = useMemo(() => {
    if (mode !== 'side-by-side') return [];
    const rows = [];
    for (const h of sbs) {
      rows.push({ kind: 'header', text: h.header });
      for (const r of h.rows) {
        rows.push({ kind: 'sbs', row: r });
      }
    }
    return rows;
  }, [mode, sbs]);

  const totalRows = (mode === 'unified' ? unifiedRows.length : sbsRows.length);
  const totalHeight = totalRows * LINE_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - BUFFER_ROWS);
  const visibleCount = Math.ceil(viewportH / LINE_HEIGHT) + 2 * BUFFER_ROWS;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resize = () => setViewportH(el.clientHeight || 320);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll);
    return () => { ro.disconnect(); el.removeEventListener('scroll', onScroll); };
  }, []);

  const onCopyClick = async () => {
    await copyToClipboard(patch || '');
    if (onCopy) onCopy();
  };

  const addColor = 'var(--mantine-color-green-6)';
  const delColor = 'var(--mantine-color-red-6)';
  const faint = (hexVar) => colorful ? (hexVar === addColor ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)') : 'transparent';
  const borderLeftFor = (type) => {
    if (type === 'add') return `3px solid ${addColor}`;
    if (type === 'del') return `3px solid ${delColor}`;
    return '3px solid transparent';
  };

  return (
    <Stack gap={6}>
      <Group justify="space-between" align="center">
        <Group gap={8}>
          <Text fw={600} size="sm">{filename}</Text>
          <Badge size="xs" variant="light" color="green">+{additions}</Badge>
          <Badge size="xs" variant="light" color="red">-{deletions}</Badge>
        </Group>
        <Tooltip label="Copy patch">
          <ActionIcon size="sm" variant="subtle" onClick={onCopyClick}><IconClipboard size={16} /></ActionIcon>
        </Tooltip>
      </Group>
      {(!patch || hunks.length === 0) ? (
        <Text size="sm" c="dimmed">No patch available.</Text>
      ) : (
        <div ref={containerRef} style={{ height, overflow: 'auto', border: '1px solid var(--mantine-color-default-border)', borderRadius: 8, background: 'var(--mantine-color-body)' }}>
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ position: 'absolute', top: startIndex * LINE_HEIGHT, left: 0, right: 0 }}>
              {mode === 'unified' ? (
                unifiedRows.slice(startIndex, endIndex).map((r, idx) => {
                  if (r.kind === 'header') {
                    return (
                      <div key={startIndex + idx} style={{ background: 'var(--mantine-color-default-hover)', color: 'var(--mantine-color-dimmed)', padding: '4px 8px', fontFamily: 'monospace', fontSize: 12, height: LINE_HEIGHT }}>
                        {r.text}
                      </div>
                    );
                  }
                  const isMeta = r.type === 'meta';
                  const bg = r.type === 'add' ? faint(addColor) : r.type === 'del' ? faint(delColor) : 'transparent';
                  const color = isMeta ? 'var(--mantine-color-dimmed)' : 'inherit';
                  return (
                    <pre key={startIndex + idx} style={{ margin: 0, padding: '2px 8px', background: bg, color, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, height: LINE_HEIGHT, animation: 'fadeIn 200ms ease-in', borderLeft: borderLeftFor(r.type) }}>
                      {r.text}
                    </pre>
                  );
                })
              ) : (
                sbsRows.slice(startIndex, endIndex).map((r, idx) => {
                  if (r.kind === 'header') {
                    return (
                      <div key={startIndex + idx} style={{ background: 'var(--mantine-color-default-hover)', color: 'var(--mantine-color-dimmed)', padding: '4px 8px', fontFamily: 'monospace', fontSize: 12, height: LINE_HEIGHT }}>
                        {r.text}
                      </div>
                    );
                  }
                  const leftBg = (r.row.kind === 'del' || r.row.kind === 'change') ? faint(delColor) : 'transparent';
                  const rightBg = (r.row.kind === 'add' || r.row.kind === 'change') ? faint(addColor) : 'transparent';
                  return (
                    <div key={startIndex + idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: LINE_HEIGHT }}>
                      <pre style={{ margin: 0, padding: '2px 8px', borderRight: '1px solid var(--mantine-color-default-border)', background: leftBg, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', animation: 'fadeIn 200ms ease-in', borderLeft: (r.row.kind === 'del' || r.row.kind === 'change') ? `3px solid ${delColor}` : '3px solid transparent' }}>{r.row.left || ''}</pre>
                      <pre style={{ margin: 0, padding: '2px 8px', background: rightBg, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', animation: 'fadeIn 200ms ease-in', borderLeft: (r.row.kind === 'add' || r.row.kind === 'change') ? `3px solid ${addColor}` : '3px solid transparent' }}>{r.row.right || ''}</pre>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
      )}
    </Stack>
  );
}
