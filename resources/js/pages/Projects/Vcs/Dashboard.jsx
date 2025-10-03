import { useEffect, useMemo, useState } from 'react';
import { Card, Group, Stack, Title, Text, Badge, Loader, Alert, SimpleGrid, Anchor, Select, Tooltip } from '@mantine/core';
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
  PointElement,
  LineElement,
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, ChartTooltip, Legend, PointElement, LineElement);

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
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');

  const loadStats = async (branchParam) => {
    setLoading(true);
    setError('');
    try {
      const params = branchParam ? { branch: branchParam } : {};
      const { data } = await axios.get(route('projects.vcs.stats', projectId), { params });
      setData(data);
      setSelectedBranch(data.branch || branchParam || '');
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadStats();
      try {
        const { data } = await axios.get(route('projects.vcs.branches', projectId));
        if (!mounted) return;
        setBranches((data?.branches || []).map(b => b.name));
      } catch (_) { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  const onSelectBranch = async (val) => {
    setSelectedBranch(val);
    await loadStats(val);
  };

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

  const prByDay = useMemo(() => {
    const arr = data?.pr_activity?.by_day || [];
    return {
      labels: arr.map(x => x.date),
      datasets: [
        { label: 'Opened', data: arr.map(x => x.opened), backgroundColor: 'rgba(34,197,94,0.5)', borderColor: 'rgba(34,197,94,1)', borderWidth: 1 },
        { label: 'Merged', data: arr.map(x => x.merged), backgroundColor: 'rgba(59,130,246,0.5)', borderColor: 'rgba(59,130,246,1)', borderWidth: 1 },
      ],
    };
  }, [data]);

  const prByWeek = useMemo(() => {
    const arr = data?.pr_activity?.by_week || [];
    return {
      labels: arr.map(x => x.week),
      datasets: [
        { label: 'Opened', data: arr.map(x => x.opened), backgroundColor: 'rgba(34,197,94,0.5)', borderColor: 'rgba(34,197,94,1)', borderWidth: 1 },
        { label: 'Merged', data: arr.map(x => x.merged), backgroundColor: 'rgba(59,130,246,0.5)', borderColor: 'rgba(59,130,246,1)', borderWidth: 1 },
      ],
    };
  }, [data]);

  if (loading) return <Group justify="center" my="md"><Loader size="sm" /></Group>;
  if (error) return <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">{error}</Alert>;
  if (!data) return null;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Stack gap={0}>
          <Title order={4}>Version control dashboard</Title>
          <Text size="xs" c="dimmed">Top committers are always from the default branch ({data.default_branch})</Text>
        </Stack>
        <Group>
          <Tooltip label={`Default: ${data.default_branch}`}><Badge variant="light">Branch: {selectedBranch || data.branch}</Badge></Tooltip>
          <Select
            placeholder="Select branch"
            size="xs"
            data={(branches || []).map(b => ({ value: b, label: b }))}
            searchable
            value={selectedBranch}
            onChange={onSelectBranch}
            nothingFound={branches.length ? 'No results' : 'Loading branches...'}
            w={220}
          />
        </Group>
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
        <ChartCard title="PR activity by day" subtitle="Opened vs Merged">
          <div style={{ height: 260 }}>
            {prByDay.labels.length === 0 ? (
              <Text size="sm" c="dimmed">No data</Text>
            ) : (
              <Bar data={prByDay} options={{ ...chartOptions, scales: { y: { beginAtZero: true } } }} />
            )}
          </div>
        </ChartCard>
        <ChartCard title="PR activity by week" subtitle="Opened vs Merged (ISO weeks)">
          <div style={{ height: 260 }}>
            {prByWeek.labels.length === 0 ? (
              <Text size="sm" c="dimmed">No data</Text>
            ) : (
              <Bar data={prByWeek} options={{ ...chartOptions, scales: { y: { beginAtZero: true } } }} />
            )}
          </div>
        </ChartCard>
      </SimpleGrid>

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
