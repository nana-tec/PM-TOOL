import { useEffect, useMemo, useState } from 'react';
import { Card, Group, Stack, Title, Text, Badge, Loader, Alert, SimpleGrid, Anchor } from '@mantine/core';
import { IconAlertCircle, IconExternalLink } from '@tabler/icons-react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, ChartTooltip, Legend);

function ChartCard({ title, subtitle, children }) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={4} mb="sm">
        <Title order={5}>{title}</Title>
        {subtitle && <Text size="xs" c="dimmed">{subtitle}</Text>}
      </Stack>
      {children}
    </Card>
  );
}

export default function VcsDashboard({ projectId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axios.get(route('projects.vcs.stats', projectId));
        if (!mounted) return;
        setData(data);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  const topWeek = data?.top_committers?.week ?? [];
  const topMonth = data?.top_committers?.month ?? [];
  const topYear = data?.top_committers?.year ?? [];

  const mkBar = (items, label) => ({
    labels: items.map(i => i.name),
    datasets: [
      {
        label,
        data: items.map(i => i.count),
        backgroundColor: 'rgba(51, 154, 240, 0.6)',
        borderColor: 'rgba(51, 154, 240, 1)',
        borderWidth: 1,
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true } },
  };

  if (loading) return <Group justify="center" my="md"><Loader size="sm" /></Group>;
  if (error) return <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">{error}</Alert>;
  if (!data) return null;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Version control dashboard</Title>
        <Badge variant="light">Default branch: {data.branch}</Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ChartCard title="Top committers (week)">
          <div style={{ height: 220 }}>
            <Bar data={mkBar(topWeek, 'Commits')} options={chartOptions} />
          </div>
        </ChartCard>
        <ChartCard title="Top committers (month)">
          <div style={{ height: 220 }}>
            <Bar data={mkBar(topMonth, 'Commits')} options={chartOptions} />
          </div>
        </ChartCard>
      </SimpleGrid>

      <ChartCard title="Top committers (year)">
        <div style={{ height: 240 }}>
          <Bar data={mkBar(topYear, 'Commits')} options={chartOptions} />
        </div>
      </ChartCard>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" p="md">
          <Title order={5}>Latest commits</Title>
          <Stack gap={6} mt="sm">
            {(data.latest_commits || []).map(c => (
              <Group key={c.sha} justify="space-between" wrap="nowrap">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="sm" fw={600} lineClamp={1}>{c.message}</Text>
                  <Text size="xs" c="dimmed">{c.sha?.slice(0,7)} · {c.author || 'Unknown'} · {c.date ? new Date(c.date).toLocaleString() : ''}</Text>
                </Stack>
                {c.url && <Anchor href={c.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>}
              </Group>
            ))}
            {(data.latest_commits || []).length === 0 && <Text size="sm" c="dimmed">No commits.</Text>}
          </Stack>
        </Card>
        <Card withBorder radius="md" p="md">
          <Title order={5}>Recent PRs/MRs</Title>
          <Stack gap={6} mt="sm">
            {(data.recent_pulls || []).map((p, idx) => (
              <Group key={idx} justify="space-between" wrap="nowrap">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="sm" fw={600} lineClamp={1}>#{p.number} · {p.title}</Text>
                  <Badge size="xs" variant="light" color={p.state === 'merged' ? 'blue' : p.state === 'open' ? 'green' : 'gray'}>{p.state}</Badge>
                </Stack>
                {p.url && <Anchor href={p.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>}
              </Group>
            ))}
            {(data.recent_pulls || []).length === 0 && <Text size="sm" c="dimmed">No requests.</Text>}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

