import ContainerBox from '@/layouts/ContainerBox';
import Layout from '@/layouts/MainLayout';
import useForm from '@/hooks/useForm';
import { currentUrlParams } from '@/utils/route';
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
  Table,
  Tabs,
  Text,
  Title,
  Tooltip,
  Stack,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const headers = [
  { key: 'rank', label: '#', help: 'Ranking based on selected mode' },
  { key: 'user', label: 'Member' },
  { key: 'planned_utilization', label: 'Planned util. %', help: 'Estimated hours due in period vs capacity' },
  { key: 'actual_utilization', label: 'Actual util. %', help: 'Time logged in period vs capacity' },
  { key: 'availability_hours', label: 'Avail. (h)', help: 'Remaining hours = capacity - planned hours' },
  { key: 'completion_rate', label: 'Completion %', help: 'Completed / Assigned (in period)' },
  { key: 'throughput_per_week', label: 'Tasks/wk', help: 'Completed tasks per week' },
  { key: 'pending', label: 'Pending', help: 'Open tasks not completed' },
  { key: 'overdue', label: 'Overdue', help: 'Open tasks past due date' },
  { key: 'completed', label: 'Completed', help: 'Completed in selected period' },
  { key: 'assigned', label: 'Assigned', help: 'Assigned (or created) in selected period' },
  { key: 'projects', label: 'Projects', help: 'Distinct projects touched in period' },
  { key: 'window_estimation_hours', label: 'Window est. (h)', help: 'Estimated hours due in selected period' },
  { key: 'time_logged_hours', label: 'Logged (h)', help: 'Sum of time logs in selected period' },
];

function UtilCell({ value }) {
  if (value === null || value === undefined) return <Text c="dimmed">—</Text>;
  const color = value >= 100 ? 'red' : value >= 90 ? 'orange' : value >= 60 ? 'yellow' : 'green';
  return (
    <div style={{ minWidth: 120 }}>
      <Group justify="space-between" gap="xs">
        <Text size="sm">{value}%</Text>
      </Group>
      <Progress value={Math.min(100, value)} color={color} size="sm" mt={6} radius="xl" />
    </div>
  );
}

function CapacityBadge({ planned, availabilityHours }) {
  if (planned >= 100) return <Badge color="red" variant="light">Over capacity</Badge>;
  if (availabilityHours <= 8) return <Badge color="orange" variant="light">At capacity</Badge>;
  return <Badge color="green" variant="light">Available</Badge>;
}

function Metric({ label, value, color = 'gray', onClick, tooltip }) {
  const content = (
    <Group gap={6} wrap="nowrap" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Badge color={color} variant="light">{value}</Badge>
    </Group>
  );
  return tooltip ? <Tooltip label={tooltip}>{content}</Tooltip> : content;
}

export default function TeamCapacity() {
  const { items, meta, dropdowns } = usePage().props;
  const params = currentUrlParams();

  const [form, submit, updateValue] = useForm('get', route('reports.team-capacity'), {
    users: params.users?.map(String) || [],
    dateRange:
      params.dateRange && params.dateRange[0] && params.dateRange[1]
        ? [dayjs(params.dateRange[0]).toDate(), dayjs(params.dateRange[1]).toDate()]
        : [dayjs().startOf('week').toDate(), dayjs().endOf('week').toDate()],
    weekly_capacity: params.weekly_capacity ? Number(params.weekly_capacity) : meta?.weekly_capacity || 40,
    rank_by: params.rank_by || meta?.rank_by || 'performance',
    view: params.view || 'table',
  });

  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeUser, setActiveUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [tasks, setTasks] = useState({ pending: [], overdue: [], completed: [] });
  const [loadingTasks, setLoadingTasks] = useState(false);

  const sorted = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const { key, dir } = sort;
      const av = key === 'user' ? a.user.name : a[key] ?? -Infinity;
      const bv = key === 'user' ? b.user.name : b[key] ?? -Infinity;
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
      style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
      title="Click to sort"
    >
      <Group gap={6} wrap="nowrap">
        <Text>{label}</Text>
        {help && <Tooltip label={help}><Badge size="xs" variant="light">?</Badge></Tooltip>}
      </Group>
    </Table.Th>
  );

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

  const TableView = (
    <ContainerBox px={0} py={0} mt={24}>
      <Table horizontalSpacing="md" verticalSpacing="sm" striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            {headers.map(h => th(h.key, h.label, h.help))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map(row => (
            <Table.Tr key={row.user.id}>
              <Table.Td>{row.rank}</Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap" onClick={() => openUserDrawer(row)} style={{ cursor: 'pointer' }}>
                  <Avatar src={row.user.avatar} size={24} radius="xl" />
                  <Text>{row.user.name}</Text>
                </Group>
              </Table.Td>
              <Table.Td><UtilCell value={row.planned_utilization} /></Table.Td>
              <Table.Td><UtilCell value={row.actual_utilization} /></Table.Td>
              <Table.Td><CapacityBadge planned={row.planned_utilization ?? 0} availabilityHours={row.availability_hours ?? 0} /> <Text size="sm" span ml={8}>{row.availability_hours?.toFixed(2)}</Text></Table.Td>
              <Table.Td>{row.completion_rate !== null && row.completion_rate !== undefined ? `${row.completion_rate}%` : '—'}</Table.Td>
              <Table.Td>{row.throughput_per_week}</Table.Td>
              <Table.Td><Badge onClick={() => openUserDrawer(row, 'pending')} variant="light" style={{ cursor: 'pointer' }}>{row.pending}</Badge></Table.Td>
              <Table.Td>{row.overdue > 0 ? <Badge color="red" variant="light" onClick={() => openUserDrawer(row, 'overdue')} style={{ cursor: 'pointer' }}>{row.overdue}</Badge> : <Text>0</Text>}</Table.Td>
              <Table.Td><Badge color="green" variant="light" onClick={() => openUserDrawer(row, 'completed')} style={{ cursor: 'pointer' }}>{row.completed}</Badge></Table.Td>
              <Table.Td>{row.assigned}</Table.Td>
              <Table.Td>{row.projects}</Table.Td>
              <Table.Td>{row.window_estimation_hours?.toFixed(2)}</Table.Td>
              <Table.Td>{row.time_logged_hours?.toFixed(2)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {sorted.length === 0 && (
        <Center mih={200}>
          <Text c="dimmed">No data. Try adjusting filters.</Text>
        </Center>
      )}
    </ContainerBox>
  );

  const CardView = (
    <ContainerBox px={0} py={0} mt={24}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {sorted.map(row => (
          <Card key={row.user.id} withBorder padding="md" radius="md">
            <Group justify="space-between">
              <Group gap="xs">
                <Avatar src={row.user.avatar} radius="xl" />
                <div>
                  <Text fw={600}>{row.user.name}</Text>
                  <Text size="xs" c="dimmed">Rank #{row.rank}</Text>
                </div>
              </Group>
              <CapacityBadge planned={row.planned_utilization ?? 0} availabilityHours={row.availability_hours ?? 0} />
            </Group>
            <Divider my="sm" />
            <Group grow>
              <div>
                <Text size="xs" c="dimmed">Planned</Text>
                <UtilCell value={row.planned_utilization} />
              </div>
              <div>
                <Text size="xs" c="dimmed">Actual</Text>
                <UtilCell value={row.actual_utilization} />
              </div>
            </Group>
            <Group mt="sm" gap="md" wrap="wrap">
              <Metric label="Pending" value={row.pending} onClick={() => openUserDrawer(row, 'pending')} />
              <Metric label="Overdue" value={row.overdue} color="red" onClick={() => openUserDrawer(row, 'overdue')} />
              <Metric label="Completed" value={row.completed} color="green" onClick={() => openUserDrawer(row, 'completed')} />
              <Metric label="Projects" value={row.projects} />
              <Metric label="Est. (h)" value={row.window_estimation_hours?.toFixed(1)} tooltip="Estimated hours due in period" />
              <Metric label="Logged (h)" value={row.time_logged_hours?.toFixed(1)} tooltip="Hours logged in period" />
            </Group>
          </Card>
        ))}
      </SimpleGrid>
    </ContainerBox>
  );

  const KanbanView = (
    <ContainerBox px={0} py={0} mt={24}>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {[
          { key: 'available', title: 'Available', filter: (r) => (r.planned_utilization ?? 0) < 90 && (r.availability_hours ?? 0) > 8 },
          { key: 'at-capacity', title: 'At capacity', filter: (r) => (r.planned_utilization ?? 0) >= 90 && (r.planned_utilization ?? 0) < 100 || (r.availability_hours ?? 0) <= 8 },
          { key: 'over-capacity', title: 'Over capacity', filter: (r) => (r.planned_utilization ?? 0) >= 100 },
        ].map(col => (
          <Card key={col.key} withBorder padding="md" radius="md">
            <Text fw={600} mb="sm">{col.title}</Text>
            <Stack>
              {sorted.filter(col.filter).map(row => (
                <Card key={row.user.id} withBorder padding="sm" radius="sm" onClick={() => openUserDrawer(row)} style={{ cursor: 'pointer' }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Avatar src={row.user.avatar} size={20} radius="xl" />
                      <Text size="sm">{row.user.name}</Text>
                    </Group>
                    <Badge variant="light">{row.planned_utilization ?? 0}%</Badge>
                  </Group>
                  <Group gap="xs" mt={6}>
                    <Badge size="xs" variant="light">Pending {row.pending}</Badge>
                    {row.overdue > 0 && <Badge size="xs" color="red" variant="light">Overdue {row.overdue}</Badge>}
                  </Group>
                </Card>
              ))}
              {sorted.filter(col.filter).length === 0 && <Text size="sm" c="dimmed">No members</Text>}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </ContainerBox>
  );

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <div>Reports</div>
        <div>Team capacity</div>
      </Breadcrumbs>

      <Title order={1} mb={20}>Team capacity</Title>

      <ContainerBox px={35} py={25}>
        <form onSubmit={submit}>
          <Group justify="space-between" align="flex-end">
            <Group gap="xl" align="flex-end">
              <MultiSelect
                label="Users"
                placeholder={form.data.users.length ? null : 'Select users'}
                w={260}
                value={form.data.users}
                onChange={values => updateValue('users', values)}
                data={dropdowns.users}
                error={form.errors.users}
              />

              <DatesProvider settings={{ timezone: 'utc' }}>
                <DatePickerInput
                  label="Date range"
                  type="range"
                  valueFormat="MMM D"
                  placeholder="Pick dates range"
                  clearable
                  allowSingleDateInRange
                  miw={220}
                  value={form.data.dateRange}
                  onChange={dates => updateValue('dateRange', dates)}
                />
              </DatesProvider>

              <NumberInput
                label="Weekly capacity (hours)"
                allowDecimal={false}
                clampBehavior="strict"
                min={1}
                w={200}
                value={form.data.weekly_capacity}
                onChange={val => updateValue('weekly_capacity', val || 0)}
                error={form.errors.weekly_capacity}
              />

              <div>
                <Text size="xs" c="dimmed" mb={6}>Ranking mode</Text>
                <SegmentedControl
                  value={form.data.rank_by}
                  onChange={val => updateValue('rank_by', val)}
                  data={[
                    { label: 'Performance', value: 'performance' },
                    { label: 'Planned', value: 'planned' },
                    { label: 'Actual', value: 'actual' },
                  ]}
                />
              </div>

              <div>
                <Text size="xs" c="dimmed" mb={6}>View</Text>
                <SegmentedControl
                  value={form.data.view}
                  onChange={val => updateValue('view', val)}
                  data={[
                    { label: 'Table', value: 'table' },
                    { label: 'Cards', value: 'cards' },
                    { label: 'Kanban', value: 'kanban' },
                  ]}
                />
              </div>
            </Group>

            <Button type="submit" disabled={form.processing}>Submit</Button>
          </Group>
        </form>
      </ContainerBox>

      {form.data.view === 'table' && TableView}
      {form.data.view === 'cards' && CardView}
      {form.data.view === 'kanban' && KanbanView}

      <Drawer opened={drawerOpen} onClose={() => setDrawerOpen(false)} title={activeUser ? activeUser.user.name : 'Member summary'} size="lg" position="right">
        {activeUser && (
          <>
            <Group gap="xs" mb="sm">
              <Badge variant="light">Rank #{activeUser.rank}</Badge>
              <CapacityBadge planned={activeUser.planned_utilization ?? 0} availabilityHours={activeUser.availability_hours ?? 0} />
            </Group>
            <Group grow>
              <div>
                <Text size="xs" c="dimmed">Planned utilization</Text>
                <UtilCell value={activeUser.planned_utilization} />
              </div>
              <div>
                <Text size="xs" c="dimmed">Actual utilization</Text>
                <UtilCell value={activeUser.actual_utilization} />
              </div>
            </Group>
            <Group mt="sm" gap="md" wrap="wrap">
              <Metric label="Pending" value={activeUser.pending} onClick={() => setActiveTab('pending')} />
              <Metric label="Overdue" value={activeUser.overdue} color="red" onClick={() => setActiveTab('overdue')} />
              <Metric label="Completed" value={activeUser.completed} color="green" onClick={() => setActiveTab('completed')} />
              <Metric label="Projects" value={activeUser.projects} />
              <Metric label="Avail. (h)" value={activeUser.availability_hours?.toFixed(1)} />
            </Group>

            <Divider my="md" />

            <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="pending">Pending</Tabs.Tab>
                <Tabs.Tab value="overdue">Overdue</Tabs.Tab>
                <Tabs.Tab value="completed">Completed</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="pending" pt="sm">
                <TasksList items={tasks.pending} loading={loadingTasks} />
              </Tabs.Panel>
              <Tabs.Panel value="overdue" pt="sm">
                <TasksList items={tasks.overdue} loading={loadingTasks} />
              </Tabs.Panel>
              <Tabs.Panel value="completed" pt="sm">
                <TasksList items={tasks.completed} loading={loadingTasks} />
              </Tabs.Panel>
            </Tabs>
          </>
        )}
      </Drawer>
    </>
  );
}

function TasksList({ items, loading }) {
  if (loading) return <Center mih={120}><Text c="dimmed">Loading…</Text></Center>;
  if (!items || items.length === 0) return <Text c="dimmed">No tasks.</Text>;
  return (
    <SimpleGrid cols={{ base: 1 }} spacing="sm">
      {items.map((t) => (
        <Card key={t.id} withBorder padding="sm" radius="sm">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text fw={600} size="sm">{t.name}</Text>
              <Group gap={6} mt={4}>
                <Badge size="xs" variant="light">{t.project_name}</Badge>
                {t.estimation && <Badge size="xs" variant="light">Est. {Number(t.estimation).toFixed(1)}h</Badge>}
                {t.due_on && <Badge size="xs" color="orange" variant="light">Due {dayjs(t.due_on).format('MMM D')}</Badge>}
                {t.completed_at && <Badge size="xs" color="green" variant="light">Done {dayjs(t.completed_at).format('MMM D')}</Badge>}
              </Group>
            </div>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}

TeamCapacity.layout = page => <Layout title='Team capacity'>{page}</Layout>;
