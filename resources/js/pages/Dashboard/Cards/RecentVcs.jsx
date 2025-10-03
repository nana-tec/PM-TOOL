import { useEffect, useState } from 'react';
import Card from '@/components/Card';
import { Anchor, Badge, Divider, Group, Loader, ScrollArea, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import axios from 'axios';

export default function RecentVcs({ projects }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Only consider a reasonable number of VCS-enabled projects to keep the dashboard snappy
        const integrated = (projects || []).filter(p => p.has_vcs).slice(0, 6);
        const results = await Promise.all(
          integrated.map(async (p) => {
            try {
              const { data } = await axios.get(route('projects.vcs.stats', p.id));
              const commits = (data?.latest_commits || []).slice(0, 5).map(c => ({
                type: 'commit',
                projectId: p.id,
                projectName: p.name,
                id: c.sha,
                title: c.message,
                subtitle: `${(c.author || 'Unknown')} · ${c.sha?.slice(0,7)}`,
                date: c.date || null,
                url: c.url || null,
              }));
              const pulls = (data?.recent_pulls || []).slice(0, 5).map(pr => ({
                type: 'pull',
                projectId: p.id,
                projectName: p.name,
                id: pr.number,
                title: pr.title,
                subtitle: `#${pr.number} · ${pr.state}`,
                date: pr.created_at || null,
                url: pr.url || null,
              }));
              const issues = (data?.recent_issues || []).slice(0, 5).map(i => ({
                type: 'issue',
                projectId: p.id,
                projectName: p.name,
                id: i.id,
                title: i.title,
                subtitle: `${i.state}`,
                date: i.created_at || null,
                url: i.url || null,
              }));
              return [...commits, ...pulls, ...issues];
            } catch (_) {
              return [];
            }
          })
        );
        if (!mounted) return;
        const merged = results.flat().filter(i => !!(i.date || i.type === 'commit'));
        merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        setItems(merged.slice(0, 30));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projects]);

  const typeBadge = (t) => {
    const map = { commit: { color: 'blue', label: 'Commit' }, pull: { color: 'grape', label: 'PR/MR' }, issue: { color: 'teal', label: 'Issue' } };
    const it = map[t] || { color: 'gray', label: t };
    return <Badge size="xs" variant="light" color={it.color}>{it.label}</Badge>;
  };

  return (
    <Card bg="none">
      <Title order={3} ml={15}>Recent VCS activity</Title>
      <Divider my={14} />
      {loading ? (
        <Group justify="center" my="sm"><Loader size="xs" /></Group>
      ) : (
        <ScrollArea h={300} scrollbarSize={7}>
          <Stack gap={10} px={6}>
            {items.map((it, idx) => (
              <Group key={`${it.type}-${it.projectId}-${it.id}-${idx}`} wrap="nowrap" justify="space-between" align="flex-start">
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={8} wrap="nowrap">
                    {typeBadge(it.type)}
                    <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1 }}>{it.title}</Text>
                  </Group>
                  <Group gap={8} wrap="nowrap">
                    <Tooltip label={it.projectName} withArrow>
                      <Text size="xs" c="dimmed" style={{ maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.projectName}</Text>
                    </Tooltip>
                    <Text size="xs" c="dimmed" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.subtitle}</Text>
                    <Text size="xs" c="dimmed">{it.date ? new Date(it.date).toLocaleString() : ''}</Text>
                  </Group>
                </Stack>
                {it.url && (
                  <Anchor href={it.url} target="_blank" rel="noreferrer" title="Open in provider">
                    <IconExternalLink size={14} />
                  </Anchor>
                )}
              </Group>
            ))}
            {items.length === 0 && (
              <Text size="sm" c="dimmed" px={6}>No recent VCS activity.</Text>
            )}
          </Stack>
        </ScrollArea>
      )}
    </Card>
  );
}
