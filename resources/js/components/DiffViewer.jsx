import React, { useMemo } from 'react';
import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconClipboard } from '@tabler/icons-react';
import { parseUnifiedPatch, buildSideBySide, copyToClipboard } from '@/utils/patch';

export default function DiffViewer({ filename, patch, mode = 'unified', onCopy, additions = 0, deletions = 0 }) {
  const hunks = useMemo(() => parseUnifiedPatch(patch || ''), [patch]);
  const sbs = useMemo(() => (mode === 'side-by-side' ? buildSideBySide(hunks) : []), [mode, hunks]);

  const onCopyClick = async () => {
    await copyToClipboard(patch || '');
    if (onCopy) onCopy();
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
      ) : mode === 'unified' ? (
        <div style={{ fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace', fontSize: 12, border: '1px solid var(--mantine-color-dark-5)', borderRadius: 6, overflow: 'hidden' }}>
          {hunks.map((h, hi) => (
            <div key={hi}>
              <div style={{ background: 'var(--mantine-color-dark-6)', color: 'var(--mantine-color-dimmed)', padding: '4px 8px' }}>{h.header}</div>
              {h.lines.map((ln, i) => {
                const bg = ln.type === 'add' ? 'rgba(34,197,94,.15)' : ln.type === 'del' ? 'rgba(239,68,68,.15)' : ln.type === 'meta' ? 'transparent' : 'transparent';
                const color = ln.type === 'meta' ? 'var(--mantine-color-dimmed)' : 'inherit';
                const prefix = ln.type === 'add' ? '+' : ln.type === 'del' ? '-' : ' ';
                return (
                  <pre key={i} style={{ margin: 0, padding: '2px 8px', background: bg, color, whiteSpace: 'pre-wrap' }}>
                    {prefix}{ln.text}
                  </pre>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--mantine-color-dark-5)', borderRadius: 6, overflow: 'hidden' }}>
          {sbs.map((h, hi) => (
            <div key={hi}>
              <div style={{ background: 'var(--mantine-color-dark-6)', color: 'var(--mantine-color-dimmed)', padding: '4px 8px', fontFamily: 'monospace', fontSize: 12 }}>{h.header}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {h.rows.map((row, i) => {
                  const leftBg = row.kind === 'del' || row.kind === 'change' ? 'rgba(239,68,68,.12)' : row.kind === 'ctx' ? 'transparent' : 'transparent';
                  const rightBg = row.kind === 'add' || row.kind === 'change' ? 'rgba(34,197,94,.12)' : row.kind === 'ctx' ? 'transparent' : 'transparent';
                  return (
                    <React.Fragment key={i}>
                      <pre style={{ margin: 0, padding: '2px 8px', borderRight: '1px solid var(--mantine-color-dark-5)', background: leftBg, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>{row.left || ''}</pre>
                      <pre style={{ margin: 0, padding: '2px 8px', background: rightBg, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>{row.right || ''}</pre>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Stack>
  );
}

