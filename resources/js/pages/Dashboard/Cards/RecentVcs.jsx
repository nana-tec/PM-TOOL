import { useEffect, useState, useMemo } from 'react';
import Card from '@/components/Card';
import { Anchor, Badge, Divider, Group, Loader, ScrollArea, SegmentedControl, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconExternalLink, IconBrandGithub, IconBrandGitlab } from '@tabler/icons-react';
import { diffForHumans } from '@/utils/datetime';
import axios from 'axios';

export default function RecentVcs({ projects }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [filterType, setFilterType] = useState('all'); // all | commit | pull | issue

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const integrated = (projects || []).filter(p => p.has_vcs).slice(0, 6);
        const results = await Promise.all(
          integrated.map(async (p) => {
            try {
              const { data } = await axios.get(route('projects.vcs.stats', p.id));
              const provider = data?.provider || 'github';
              const commits = (data?.latest_commits || []).slice(0, 5).map(c => ({
                type: 'commit',
                provider,
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
                provider,
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
                provider,
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

  const filtered = useMemo(() => {
    if (filterType === 'all') return items;
    return items.filter(i => i.type === filterType);
  }, [items, filterType]);

  const typeBadge = (t) => {
    const map = { commit: { color: 'blue', label: 'Commit' }, pull: { color: 'grape', label: 'PR/MR' }, issue: { color: 'teal', label: 'Issue' } };
    const it = map[t] || { color: 'gray', label: t };
    return <Badge size="xs" variant="light" color={it.color}>{it.label}</Badge>;
  };

  const providerIcon = (provider) => {
    if (provider === 'gitlab') return <IconBrandGitlab size={14} />;
    return <IconBrandGithub size={14} />;
  };

  return (
    <Card bg="none">
      <Group justify="space-between" align="center" px={10}>
        <Title order={3}>Recent VCS activity</Title>
        <SegmentedControl
          size="xs"
          value={filterType}
          onChange={setFilterType}
          data={[
            { label: 'All', value: 'all' },
            { label: 'Commits', value: 'commit' },
            { label: 'PRs', value: 'pull' },
            { label: 'Issues', value: 'issue' },
          ]}
        />
      </Group>
      <Divider my={14} />
      {loading ? (
        <Group justify="center" my="sm"><Loader size="xs" /></Group>
      ) : (
        <ScrollArea h={300} scrollbarSize={7}>
          <Stack gap={10} px={6}>
            {filtered.map((it, idx) => (
              <Group key={`${it.type}-${it.projectId}-${it.id}-${idx}`} wrap="nowrap" justify="space-between" align="flex-start">
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={8} wrap="nowrap">
                    {typeBadge(it.type)}
                    {providerIcon(it.provider)}
                    <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1 }}>{it.title}</Text>
                  </Group>
                  <Group gap={8} wrap="nowrap">
                    <Tooltip label={it.projectName} withArrow>
                      <Text size="xs" c="dimmed" style={{ maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.projectName}</Text>
                    </Tooltip>
                    <Text size="xs" c="dimmed" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.subtitle}</Text>
                    <Tooltip label={it.date ? new Date(it.date).toLocaleString() : ''} withArrow>
                      <Text size="xs" c="dimmed">{it.date ? diffForHumans(it.date) : ''}</Text>
                    </Tooltip>
                  </Group>
                </Stack>
                {it.url && (
                  <Anchor href={it.url} target="_blank" rel="noreferrer" title="Open in provider">
                    <IconExternalLink size={14} />
                  </Anchor>
                )}
              </Group>
            ))}
            {filtered.length === 0 && (
              <Text size="sm" c="dimmed" px={6}>No recent VCS activity.</Text>
            )}
          </Stack>
        </ScrollArea>
      )}
    </Card>
  );
}
