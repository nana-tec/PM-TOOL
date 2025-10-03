import { useEffect, useState } from 'react';
import { Card, Group, Stack, Title, Text, Anchor, Loader } from '@mantine/core';
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
        const integrated = (projects || []).filter(p => p.has_vcs).slice(0, 5);
        const results = await Promise.all(integrated.map(async (p) => {
          try {
            const { data } = await axios.get(route('projects.vcs.stats', p.id));
            const commits = (data?.latest_commits || []).map(c => ({
              projectId: p.id,
              projectName: p.name,
              sha: c.sha,
              message: c.message,
              author: c.author,
              date: c.date,
              url: c.url,
            }));
            return commits;
          } catch (_) {
            return [];
          }
        }));
        if (!mounted) return;
        const merged = results.flat().filter(c => !!c.date);
        merged.sort((a, b) => new Date(b.date) - new Date(a.date));
        setItems(merged.slice(0, 15));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projects]);

  return (
    <Card withBorder radius="md" p="md">
      <Title order={5}>Recent VCS commits</Title>
      {loading ? (
        <Group justify="center" my="sm"><Loader size="xs" /></Group>
      ) : (
        <Stack gap={8} mt="sm">
          {items.map((c) => (
            <Group key={`${c.projectId}-${c.sha}`} justify="space-between" wrap="nowrap">
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={600} lineClamp={1}>{c.message}</Text>
                <Text size="xs" c="dimmed">{c.projectName} · {c.sha.slice(0,7)} · {c.author || 'Unknown'} · {c.date ? new Date(c.date).toLocaleString() : ''}</Text>
              </Stack>
              {c.url && <Anchor href={c.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>}
            </Group>
          ))}
          {items.length === 0 && <Text size="sm" c="dimmed">No recent commits.</Text>}
        </Stack>
      )}
    </Card>
  );
}

