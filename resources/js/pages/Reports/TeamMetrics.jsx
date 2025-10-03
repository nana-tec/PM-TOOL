import ContainerBox from '@/layouts/ContainerBox';
import Layout from '@/layouts/MainLayout';
import useForm from '@/hooks/useForm';
import { currentUrlParams, redirectTo } from '@/utils/route';
import { usePage } from '@inertiajs/react';
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Center,
  Divider,
  Drawer,
  Group,
  MultiSelect,
  NumberInput,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
  Tooltip,
  ThemeIcon,
  rem,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import { IconUser, IconClock, IconTrendingUp, IconAlertTriangle } from '@tabler/icons-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, BarElement, LineElement, ChartTooltip, Legend);

import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const headers = [
  { key: 'rank', label: '#', help: 'Ranking based on selected mode' },
  { key: 'user', label: 'Member' },
  { key: 'availability_hours', label: 'Free (h)', help: 'Remaining hours = capacity - planned hours (due this period)' },
  { key: 'planned_utilization', label: 'Planned %', help: 'Hours due this period vs capacity' },
  { key: 'actual_utilization', label: 'Actual %', help: 'Time logged this period vs capacity' },
  { key: 'active_days', label: 'Active days', help: 'Days with time activity' },
  { key: 'idle_days', label: 'Idle days', help: 'Days without time activity' },
  { key: 'avg_daily_hours', label: 'Avg h/day', help: 'Average logged hours per active day' },
  { key: 'start_latency_hours', label: 'Start latency', help: 'Avg hours from assignment to first log' },
  { key: 'completion_rate', label: 'Completion', help: 'Completed / Assigned (in period)' },
  { key: 'throughput_per_week', label: 'Throughput', help: 'Completed tasks per week' },
  { key: 'risk_score', label: 'Risk', help: 'Composite risk: overdue, utilization, idle, completion' },
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Done' },
  { key: 'projects', label: 'Projects' },
];

function UtilCell({ value, showProgress = true }) {
  if (value === null || value === undefined) return <Text c="dimmed" size="sm">—</Text>;
  const getColor = (val) => {
    if (val >= 100) return 'red';
    if (val >= 90) return 'orange';
    if (val >= 75) return 'yellow';
    if (val >= 50) return 'blue';
    return 'green';
  };
  const color = getColor(value);
  return (
    <Stack gap={4} style={{ minWidth: showProgress ? 100 : 'auto' }}>
      <Text size="sm" fw={500}>{value}%</Text>
      {showProgress && (
        <Progress value={Math.min(100, value)} color={color} size="sm" radius="xl" />
      )}
    </Stack>
  );
}

function MetricCard({ member, onClick }) {
  const statusColor = (member.planned_utilization ?? 0) >= 100 ? 'red' : (member.availability_hours ?? 0) <= 8 ? 'orange' : 'green';
  return (
    <Card withBorder padding="lg" radius="md" style={{ cursor: 'pointer' }} onClick={() => onClick(member)}>
      <Group justify="space-between" mb="md">
        <Group gap="md">
          <Avatar src={member.user.avatar} size="lg" radius="xl" onClick={(e) => { e.stopPropagation(); redirectTo('users.edit', [member.user.id]); }} style={{ cursor: 'pointer' }} />
          <Stack gap={4}>
            <Text fw={600} size="lg">{member.user.name}</Text>
            <Group gap="xs">
              <Badge size="sm" variant="light">Rank #{member.rank}</Badge>
              <Badge size="sm" color={statusColor} variant="light">{(member.availability_hours ?? 0) <= 8 ? 'At/Over capacity' : 'Available'}</Badge>
              <Badge size="sm" color="gray" variant="light">Risk {member.risk_score?.toFixed(1)}</Badge>
            </Group>
          </Stack>
        </Group>
        <ThemeIcon size="xl" radius="xl" color={statusColor} variant="light">
          <IconUser style={{ width: rem(20), height: rem(20) }} />
        </ThemeIcon>
      </Group>

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Free hours</Text>
          <Group gap="xs"><IconClock size={16} /><Text fw={700}>{member.availability_hours?.toFixed(1)}h</Text></Group>
        </Stack>
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Planned %</Text>
          <UtilCell value={member.planned_utilization} showProgress={false} />
        </Stack>
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Actual %</Text>
          <UtilCell value={member.actual_utilization} showProgress={false} />
        </Stack>
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Avg h/day</Text>
          <Text fw={700}>{member.avg_daily_hours?.toFixed(2)}</Text>
        </Stack>
      </SimpleGrid>

      <Group justify="space-between" gap="xs">
        <Group gap={8}>
          <Badge variant="light">{member.active_days} active</Badge>
          <Badge color="gray" variant="light">{member.idle_days} idle</Badge>
          {member.start_latency_hours !== null && <Badge color="orange" variant="light">Latency {member.start_latency_hours?.toFixed(1)}h</Badge>}
          <Badge color="blue" variant="light">{member.throughput_per_week}/wk</Badge>
          {member.completion_rate !== null && <Badge color={member.completion_rate >= 80 ? 'green' : member.completion_rate >= 60 ? 'orange' : 'red'} variant="light">{member.completion_rate}%</Badge>}
        </Group>
        <Group gap={8}>
          <Badge variant="light" onClick={(e) => { e.stopPropagation(); onClick(member, 'pending'); }} style={{ cursor: 'pointer' }}>{member.pending} Pending</Badge>
          {member.overdue > 0 && <Badge color="red" variant="light" onClick={(e) => { e.stopPropagation(); onClick(member, 'overdue'); }} style={{ cursor: 'pointer' }}>{member.overdue} Overdue</Badge>}
          <Badge color="green" variant="light" onClick={(e) => { e.stopPropagation(); onClick(member, 'completed'); }} style={{ cursor: 'pointer' }}>{member.completed} Done</Badge>
        </Group>
      </Group>
    </Card>
  );
}

export default function TeamMetrics() {
  const { items, meta, dropdowns } = usePage().props;
  const params = currentUrlParams();

  const [form, submit, updateValue] = useForm('get', route('reports.team-metrics'), {
    users: params.users?.map(String) || [],
    dateRange:
      params.dateRange && params.dateRange[0] && params.dateRange[1]
        ? [dayjs(params.dateRange[0]).toDate(), dayjs(params.dateRange[1]).toDate()]
        : [dayjs().startOf('week').toDate(), dayjs().endOf('week').toDate()],
    weekly_capacity: params.weekly_capacity ? Number(params.weekly_capacity) : meta?.weekly_capacity || 40,
    rank_by: params.rank_by || meta?.rank_by || 'performance',
    view: params.view || 'cards',
  });

  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeUser, setActiveUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [tasks, setTasks] = useState({ pending: [], overdue: [], completed: [] });
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [projectsDropdown, setProjectsDropdown] = useState([]);
  const [suggestProject, setSuggestProject] = useState('');
  const [exporting, setExporting] = useState(false);
  const [chartsMode, setChartsMode] = useState('capacity'); // capacity|risk|util

  const openUserDrawer = (row, tab = 'pending') => {
    setActiveUser(row);
    setActiveTab(tab);
    setDrawerOpen(true);
  };

  const fetchTasks = async (status) => {
    if (!activeUser) return;
    setLoadingTasks(true);
    try {
      const [start, end] = form.data.dateRange || [];
      const { data } = await axios.get(route('reports.team-capacity.user-tasks'), {
        params: {
          user_id: activeUser.user.id,
          status,
          dateRange: [
            start ? dayjs(start).toISOString() : undefined,
            end ? dayjs(end).toISOString() : undefined,
          ],
        },
      });
      setTasks(prev => ({ ...prev, [status]: data.tasks || [] }));
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (drawerOpen) fetchTasks(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, activeTab]);

  // Load projects for suggestion filter
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(route('dropdown.values'), { params: { projects: true } });
        const dd = (data?.projects || []).map(p => ({ value: String(p.value || p.id), label: p.label || p.name }));
        setProjectsDropdown(dd);
      } catch (_) { /* ignore */ }
    })();
  }, []);

  // Saved views (localStorage)
  const saveCurrentView = () => {
    const name = prompt('Name this view:');
    if (!name) return;
    const key = 'teamMetricsViews';
    const views = JSON.parse(localStorage.getItem(key) || '[]');
    const payload = { name, data: form.data };
    const next = [payload, ...views.filter(v => v.name !== name)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(next));
    alert('View saved');
  };
  const loadSavedView = () => {
    const key = 'teamMetricsViews';
    const views = JSON.parse(localStorage.getItem(key) || '[]');
    if (views.length === 0) return alert('No saved views');
    const name = prompt('Load view by name:\n' + views.map(v => `- ${v.name}`).join('\n'));
    const pick = views.find(v => v.name === name);
    if (pick) {
      updateValue('users', pick.data.users || []);
      updateValue('dateRange', pick.data.dateRange || form.data.dateRange);
      updateValue('weekly_capacity', pick.data.weekly_capacity || form.data.weekly_capacity);
      updateValue('rank_by', pick.data.rank_by || form.data.rank_by);
      updateValue('view', pick.data.view || form.data.view);
      submit();
    }
  };
  const deleteSavedView = () => {
    const key = 'teamMetricsViews';
    const views = JSON.parse(localStorage.getItem(key) || '[]');
    if (views.length === 0) return alert('No saved views');
    const name = prompt('Delete view name:');
    const next = views.filter(v => v.name !== name);
    localStorage.setItem(key, JSON.stringify(next));
    alert('Deleted (if existed)');
  };

  // Exports
  const exportJSON = () => {
    try {
      setExporting(true);
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'team-metrics.json'; a.click(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };
  const exportCSV = () => {
    try {
      setExporting(true);
      const cols = ['rank','user.name','availability_hours','planned_utilization','actual_utilization','active_days','idle_days','avg_daily_hours','start_latency_hours','completion_rate','throughput_per_week','risk_score','pending','overdue','completed','projects'];
      const rows = [cols.join(',')];
      items.forEach(i => {
        const r = [i.rank, i.user?.name, i.availability_hours, i.planned_utilization, i.actual_utilization, i.active_days, i.idle_days, i.avg_daily_hours, i.start_latency_hours, i.completion_rate, i.throughput_per_week, i.risk_score, i.pending, i.overdue, i.completed, i.projects];
        rows.push(r.map(v => (v === null || v === undefined) ? '' : String(v)).join(','));
      });
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'team-metrics.csv'; a.click(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  // Suggestions
  const fetchSuggestions = async () => {
    setSuggesting(true);
    try {
      const params = { limit: 5 };
      if (suggestProject) params.project_id = suggestProject;
      const { data } = await axios.get(route('reports.team-metrics.suggest'), { params });
      setSuggestions(data.candidates || []);
    } finally { setSuggesting(false); }
  };

  // Charts data
  const charts = useMemo(() => {
    const labels = items.slice(0, 12).map(i => i.user.name.split(' ')[0]);
    const capVsActual = {
      labels,
      datasets: [
        { label: 'Planned %', data: items.slice(0, 12).map(i => i.planned_utilization ?? 0), backgroundColor: 'rgba(54, 162, 235, 0.6)' },
        { label: 'Actual %', data: items.slice(0, 12).map(i => i.actual_utilization ?? 0), backgroundColor: 'rgba(255, 159, 64, 0.6)' },
      ],
    };
    const riskLine = {
      labels: items.slice(0, 20).map(i => `#${i.rank}`),
      datasets: [ { label: 'Risk score', data: items.slice(0, 20).map(i => i.risk_score ?? 0), borderColor: 'rgba(255,99,132,1)', backgroundColor: 'rgba(255,99,132,0.2)', tension: 0.2 } ],
    };
    // Utilization histogram (planned)
    const buckets = [0,10,20,30,40,50,60,70,80,90,100];
    const counts = new Array(buckets.length).fill(0);
    items.forEach(i => { const v = Math.min(100, Math.max(0, Math.round(i.planned_utilization ?? 0))); const idx = Math.min(buckets.length-1, Math.floor(v/10)); counts[idx]++; });
    const utilHist = { labels: buckets.map(b => `${b}-${b+9}%`).slice(0,10).concat(['100%']), datasets: [ { label: 'Members', data: counts, backgroundColor: 'rgba(75,192,192,0.6)' } ] };
    return { capVsActual, riskLine, utilHist };
  }, [items]);

  // Sorted items for the table view
  const sorted = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const { key, dir } = sort;
      const av = key === 'user' ? a.user.name : (a[key] ?? -Infinity);
      const bv = key === 'user' ? b.user.name : (b[key] ?? -Infinity);
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [items, sort]);

  const th = (key, label, help) => (
    <Table.Th
      key={key}
      onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
      style={{ cursor: 'pointer' }}
    >
      <Group gap={4} wrap="nowrap">
        <Text size="sm" fw={600}>{label}</Text>
        {help && <Tooltip label={help}><Badge size="xs" variant="outline" color="gray">?</Badge></Tooltip>}
        <Text size="xs" c="dimmed">{sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</Text>
      </Group>
    </Table.Th>
  );

  const TableView = (
    <ContainerBox px="md" py="md" mt={24}>
      <Table.ScrollContainer minWidth={1400}>
        <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
          <Table.Thead>
            <Table.Tr>
              {headers.map(h => th(h.key, h.label, h.help))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map(row => (
              <Table.Tr key={row.user.id} style={{ cursor: 'pointer' }}>
                <Table.Td><Badge size="lg" variant="light" color="gray">#{row.rank}</Badge></Table.Td>
                <Table.Td>
                  <Group gap="md" wrap="nowrap" onClick={() => redirectTo('users.edit', [row.user.id])} style={{ cursor: 'pointer' }}>
                    <Avatar src={row.user.avatar} size={36} radius="xl" />
                    <Stack gap={2}>
                      <Text fw={600}>{row.user.name}</Text>
                      <Text size="xs" c="dimmed">View profile →</Text>
                    </Stack>
                  </Group>
                </Table.Td>
                <Table.Td><Group gap="xs"><IconClock size={16} /><Text fw={500}>{row.availability_hours?.toFixed(1)}h</Text></Group></Table.Td>
                <Table.Td><UtilCell value={row.planned_utilization} /></Table.Td>
                <Table.Td><UtilCell value={row.actual_utilization} /></Table.Td>
                <Table.Td><Text fw={500}>{row.active_days}</Text></Table.Td>
                <Table.Td><Text fw={500}>{row.idle_days}</Text></Table.Td>
                <Table.Td><Text fw={500}>{row.avg_daily_hours?.toFixed(2)}</Text></Table.Td>
                <Table.Td><Text fw={500}>{row.start_latency_hours !== null ? `${row.start_latency_hours?.toFixed(1)}h` : '—'}</Text></Table.Td>
                <Table.Td><Text fw={500} c={row.completion_rate >= 80 ? 'green' : row.completion_rate >= 60 ? 'orange' : 'red'}>{row.completion_rate !== null ? `${row.completion_rate}%` : '—'}</Text></Table.Td>
                <Table.Td><Group gap="xs"><IconTrendingUp size={16} /><Text fw={500}>{row.throughput_per_week}/wk</Text></Group></Table.Td>
                <Table.Td>
                  <Badge color={row.risk_score >= 70 ? 'red' : row.risk_score >= 40 ? 'orange' : 'green'} variant="light">{row.risk_score?.toFixed(1)}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge onClick={(e) => { e.stopPropagation(); openUserDrawer(row, 'pending'); }} variant="light" style={{ cursor: 'pointer' }} size="md">{row.pending}</Badge>
                </Table.Td>
                <Table.Td>
                  {row.overdue > 0 ? (
                    <Badge color="red" variant="light" onClick={(e) => { e.stopPropagation(); openUserDrawer(row, 'overdue'); }} style={{ cursor: 'pointer' }} size="md">{row.overdue}</Badge>
                  ) : (<Text c="dimmed">0</Text>)}
                </Table.Td>
                <Table.Td>
                  <Badge color="green" variant="light" onClick={(e) => { e.stopPropagation(); openUserDrawer(row, 'completed'); }} style={{ cursor: 'pointer' }} size="md">{row.completed}</Badge>
                </Table.Td>
                <Table.Td><Text fw={500}>{row.projects}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {sorted.length === 0 && (
        <Center mih={200}><Text c="dimmed">No data for selected filters.</Text></Center>
      )}
    </ContainerBox>
  );

  const CardsView = (
    <ContainerBox px="md" py="md" mt={24}>
      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
        {items.map((m) => (
          <MetricCard key={m.user.id} member={m} onClick={openUserDrawer} />
        ))}
      </SimpleGrid>
      {items.length === 0 && (
        <Center mih={200}><Text c="dimmed">No data for selected filters.</Text></Center>
      )}
    </ContainerBox>
  );

  return (
    <Layout title="Team metrics">
      <Breadcrumbs mt={10}>
        <Text onClick={() => redirectTo('dashboard')} style={{ cursor: 'pointer' }}>Dashboard</Text>
        <Text c="dimmed">Team metrics</Text>
      </Breadcrumbs>

      <ContainerBox mt={20}>
        <Stack>
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Title order={3}>Team metrics</Title>
            <Group>
              <Button variant="subtle" onClick={() => redirectTo('reports.team-capacity')}>Open team capacity →</Button>
              <Button variant="light" onClick={submit}>Apply filters</Button>
            </Group>
          </Group>

          <Group wrap="wrap" align="flex-end" gap="md">
            <DatesProvider settings={{ firstDayOfWeek: 1 }}>
              <DatePickerInput type="range" label="Date range" value={form.data.dateRange} onChange={(v) => updateValue('dateRange', v)} maw={320} />
            </DatesProvider>
            <NumberInput label="Weekly capacity (h)" value={form.data.weekly_capacity} onChange={(v) => updateValue('weekly_capacity', Number(v))} min={1} max={80} maw={200} />
            <MultiSelect label="Members" value={form.data.users} onChange={(v) => updateValue('users', v)} data={(dropdowns?.users || []).map(u => ({ value: String(u.value), label: u.label }))} maw={360} searchable clearable />
            <SegmentedControl data={[
              { label: 'Performance', value: 'performance' },
              { label: 'Availability', value: 'availability' },
              { label: 'Risk', value: 'risk' },
              { label: 'Utilization', value: 'planned' },
              { label: 'Actual', value: 'actual' },
            ]} value={form.data.rank_by} onChange={(v) => updateValue('rank_by', v)} />
            <SegmentedControl data={[
              { label: 'Cards', value: 'cards' },
              { label: 'Table', value: 'table' },
            ]} value={form.data.view} onChange={(v) => updateValue('view', v)} />
            <Button variant="subtle" onClick={saveCurrentView}>Save view</Button>
            <Button variant="subtle" onClick={loadSavedView}>Load view</Button>
            <Button variant="subtle" color="red" onClick={deleteSavedView}>Delete view</Button>
            <Button variant="light" loading={exporting} onClick={exportCSV}>Export CSV</Button>
            <Button variant="light" loading={exporting} onClick={exportJSON}>Export JSON</Button>
          </Group>
        </Stack>
      </ContainerBox>

      {/* Charts */}
      <ContainerBox px="md" py="md" mt={12}>
        <Group justify="space-between" align="center" mb="sm">
          <Title order={5}>Trends</Title>
          <SegmentedControl size="xs" value={chartsMode} onChange={setChartsMode} data={[{label:'Capacity vs Actual', value:'capacity'}, {label:'Risk trend', value:'risk'}, {label:'Utilization hist', value:'util'}]} />
        </Group>
        {chartsMode === 'capacity' && (
          <Bar data={charts.capVsActual} options={{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true, max:100 } } }} />
        )}
        {chartsMode === 'risk' && (
          <Line data={charts.riskLine} options={{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true, max:100 } } }} />
        )}
        {chartsMode === 'util' && (
          <Bar data={charts.utilHist} options={{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } }} />
        )}
      </ContainerBox>

      {/* Suggest assignments */}
      <ContainerBox px="md" py="md" mt={12}>
        <Group justify="space-between" align="center" mb="sm">
          <Title order={5}>Suggest assignments</Title>
          <Group>
            <MultiSelect data={projectsDropdown} value={suggestProject ? [String(suggestProject)] : []} onChange={(vals)=> setSuggestProject(vals[0] || '')} searchable clearable placeholder="Filter by project (optional)" maw={360} nothingFound="No projects" />
            <Button onClick={fetchSuggestions} loading={suggesting}>Find candidates</Button>
          </Group>
        </Group>
        <SimpleGrid cols={{ base:1, md:2, lg:3 }}>
          {suggestions.map(c => (
            <Card key={c.user.id} withBorder radius="md" p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text fw={600}>{c.user.name}</Text>
                  <Text size="xs" c="dimmed">Free {c.availability_hours?.toFixed(1)}h · Planned {c.planned_utilization ?? 0}% · Actual {c.actual_utilization ?? 0}%</Text>
                  {(c.pending > 0 || c.overdue > 0) && (
                    <Group gap={6}>
                      {c.pending > 0 && <Badge variant="light">{c.pending} pending</Badge>}
                      {c.overdue > 0 && <Badge color="red" variant="light">{c.overdue} overdue</Badge>}
                    </Group>
                  )}
                </Stack>
                <Button size="xs" variant="light" onClick={() => redirectTo('users.index')}>View</Button>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
        {suggestions.length === 0 && <Text c="dimmed" size="sm">No suggestions loaded. Pick a project and click "Find candidates".</Text>}
      </ContainerBox>

      {form.data.view === 'table' ? TableView : CardsView}

      <Drawer opened={drawerOpen} onClose={() => setDrawerOpen(false)} title={activeUser ? activeUser.user.name : 'Member'} size="lg">
        {!activeUser ? (
          <Center mih={120}><Text c="dimmed">Select a member to view their tasks</Text></Center>
        ) : (
          <Stack>
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="pending" onClick={() => fetchTasks('pending')}>Pending</Tabs.Tab>
                <Tabs.Tab value="overdue" onClick={() => fetchTasks('overdue')}>Overdue</Tabs.Tab>
                <Tabs.Tab value="completed" onClick={() => fetchTasks('completed')}>Completed</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="pending" pt="xs">
                {loadingTasks ? <Center my="sm"><Text size="sm">Loading…</Text></Center> : (
                  <Stack>
                    {tasks.pending.map(t => (
                      <Card key={t.id} withBorder radius="sm" p="sm">
                        <Group justify="space-between">
                          <Stack gap={2}>
                            <Text fw={600} size="sm">{t.name}</Text>
                            <Text size="xs" c="dimmed">{t.project_name}</Text>
                          </Stack>
                          {t.due_on && <Badge color="red" variant="light">Due {t.due_on}</Badge>}
                        </Group>
                      </Card>
                    ))}
                    {tasks.pending.length === 0 && <Text c="dimmed">No pending tasks.</Text>}
                  </Stack>
                )}
              </Tabs.Panel>
              <Tabs.Panel value="overdue" pt="xs">
                {loadingTasks ? <Center my="sm"><Text size="sm">Loading…</Text></Center> : (
                  <Stack>
                    {tasks.overdue.map(t => (
                      <Card key={t.id} withBorder radius="sm" p="sm">
                        <Group justify="space-between">
                          <Stack gap={2}>
                            <Text fw={600} size="sm">{t.name}</Text>
                            <Text size="xs" c="dimmed">{t.project_name}</Text>
                          </Stack>
                          {t.due_on && <Badge color="red" variant="light">Due {t.due_on}</Badge>}
                        </Group>
                      </Card>
                    ))}
                    {tasks.overdue.length === 0 && <Text c="dimmed">No overdue tasks.</Text>}
                  </Stack>
                )}
              </Tabs.Panel>
              <Tabs.Panel value="completed" pt="xs">
                {loadingTasks ? <Center my="sm"><Text size="sm">Loading…</Text></Center> : (
                  <Stack>
                    {tasks.completed.map(t => (
                      <Card key={t.id} withBorder radius="sm" p="sm">
                        <Group justify="space-between">
                          <Stack gap={2}>
                            <Text fw={600} size="sm">{t.name}</Text>
                            <Text size="xs" c="dimmed">{t.project_name}</Text>
                          </Stack>
                          {t.completed_at && <Badge color="green" variant="light">Done</Badge>}
                        </Group>
                      </Card>
                    ))}
                    {tasks.completed.length === 0 && <Text c="dimmed">No completed tasks in range.</Text>}
                  </Stack>
                )}
              </Tabs.Panel>
            </Tabs>
          </Stack>
        )}
      </Drawer>
    </Layout>
  );
}
