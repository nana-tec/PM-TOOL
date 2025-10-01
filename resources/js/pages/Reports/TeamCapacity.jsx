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
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const headers = [
  { key: 'rank', label: '#', help: 'Ranking based on selected mode' },
  { key: 'user', label: 'Member' },
  { key: 'planned_utilization', label: 'Planned', help: 'Estimated hours due in period vs capacity' },
  { key: 'actual_utilization', label: 'Actual', help: 'Time logged in period vs capacity' },
  { key: 'availability_hours', label: 'Available', help: 'Remaining hours = capacity - planned hours' },
  { key: 'completion_rate', label: 'Completion', help: 'Completed / Assigned (in period)' },
  { key: 'throughput_per_week', label: 'Throughput', help: 'Completed tasks per week' },
  { key: 'pending', label: 'Pending', help: 'Open tasks not completed' },
  { key: 'overdue', label: 'Overdue', help: 'Open tasks past due date' },
  { key: 'completed', label: 'Done', help: 'Completed in selected period' },
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

function CapacityCard({ member, onClick }) {
  const getStatusColor = (planned, availability) => {
    if (planned >= 100) return 'red';
    if (availability <= 8) return 'orange';
    return 'green';
  };

  const getStatusText = (planned, availability) => {
    if (planned >= 100) return 'Over capacity';
    if (availability <= 8) return 'At capacity';
    return 'Available';
  };

  const statusColor = getStatusColor(member.planned_utilization ?? 0, member.availability_hours ?? 0);
  const statusText = getStatusText(member.planned_utilization ?? 0, member.availability_hours ?? 0);

  return (
    <Card
      withBorder
      padding="lg"
      radius="md"
      style={{ cursor: 'pointer', transition: 'transform 0.1s ease' }}
      onClick={() => onClick(member)}
      className="hover:shadow-lg transform hover:scale-[1.02]"
    >
      <Group justify="space-between" mb="md">
        <Group gap="md">
          <Avatar
            src={member.user.avatar}
            size="lg"
            radius="xl"
            onClick={(e) => {
              e.stopPropagation();
              redirectTo('users.edit', [member.user.id]);
            }}
            style={{ cursor: 'pointer' }}
          />
          <Stack gap={4}>
            <Text fw={600} size="lg">{member.user.name}</Text>
            <Group gap="xs">
              <Badge size="sm" variant="light">Rank #{member.rank}</Badge>
              <Badge size="sm" color={statusColor} variant="light">{statusText}</Badge>
            </Group>
          </Stack>
        </Group>
        <ThemeIcon
          size="xl"
          radius="xl"
          color={statusColor}
          variant="light"
        >
          <IconUser style={{ width: rem(20), height: rem(20) }} />
        </ThemeIcon>
      </Group>

      <SimpleGrid cols={2} spacing="md" mb="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Planned Utilization</Text>
          <UtilCell value={member.planned_utilization} showProgress={false} />
        </Stack>
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Actual Utilization</Text>
          <UtilCell value={member.actual_utilization} showProgress={false} />
        </Stack>
      </SimpleGrid>

      <Progress
        value={Math.min(100, member.planned_utilization ?? 0)}
        color={statusColor}
        size="md"
        radius="xl"
        mb="md"
      />

      <Group justify="space-between" gap="xs">
        <Tooltip label="Click to view pending tasks">
          <Badge
            variant="light"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onClick(member, 'pending');
            }}
          >
            {member.pending} Pending
          </Badge>
        </Tooltip>

        {member.overdue > 0 && (
          <Tooltip label="Click to view overdue tasks">
            <Badge
              color="red"
              variant="light"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onClick(member, 'overdue');
              }}
            >
              {member.overdue} Overdue
            </Badge>
          </Tooltip>
        )}

        <Tooltip label="Click to view completed tasks">
          <Badge
            color="green"
            variant="light"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onClick(member, 'completed');
            }}
          >
            {member.completed} Done
          </Badge>
        </Tooltip>
      </Group>

      <Divider my="sm" />

      <Group justify="space-between" gap="xs">
        <Group gap="md">
          <Tooltip label="Available hours for new work">
            <Group gap={4}>
              <IconClock size={14} />
              <Text size="sm">{member.availability_hours?.toFixed(1)}h free</Text>
            </Group>
          </Tooltip>
          <Tooltip label="Tasks completed per week">
            <Group gap={4}>
              <IconTrendingUp size={14} />
              <Text size="sm">{member.throughput_per_week}/wk</Text>
            </Group>
          </Tooltip>
          <Tooltip label="Completion rate in period">
            <Text size="sm" fw={500}>
              {member.completion_rate !== null ? `${member.completion_rate}%` : '—'} rate
            </Text>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
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
    view: params.view || 'cards',
  });

  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeUser, setActiveUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [tasks, setTasks] = useState({ pending: [], overdue: [], completed: [] });
  const [loadingTasks, setLoadingTasks] = useState(false);

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
      <Table.ScrollContainer minWidth={1200}>
        <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
          <Table.Thead>
            <Table.Tr>
              {headers.map(h => th(h.key, h.label, h.help))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map(row => (
              <Table.Tr key={row.user.id} style={{ cursor: 'pointer' }}>
                <Table.Td>
                  <Badge size="lg" variant="light" color="gray">
                    #{row.rank}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group
                    gap="md"
                    wrap="nowrap"
                    onClick={() => redirectTo('users.edit', [row.user.id])}
                    style={{ cursor: 'pointer' }}
                  >
                    <Avatar src={row.user.avatar} size={36} radius="xl" />
                    <Stack gap={2}>
                      <Text fw={600}>{row.user.name}</Text>
                      <Text size="xs" c="dimmed">View profile →</Text>
                    </Stack>
                  </Group>
                </Table.Td>
                <Table.Td><UtilCell value={row.planned_utilization} /></Table.Td>
                <Table.Td><UtilCell value={row.actual_utilization} /></Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <IconClock size={16} />
                    <Text fw={500}>{row.availability_hours?.toFixed(1)}h</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text fw={500} c={row.completion_rate >= 80 ? 'green' : row.completion_rate >= 60 ? 'orange' : 'red'}>
                    {row.completion_rate !== null ? `${row.completion_rate}%` : '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <IconTrendingUp size={16} />
                    <Text fw={500}>{row.throughput_per_week}/wk</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge
                    onClick={(e) => { e.stopPropagation(); openUserDrawer(row, 'pending'); }}
                    variant="light"
                    style={{ cursor: 'pointer' }}
                    size="md"
                  >
                    {row.pending}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {row.overdue > 0 ? (
                    <Badge
                      color="red"
                      variant="light"
                      onClick={(e) => { e.stopPropagation(); openUserDrawer(row, 'overdue'); }}
                      style={{ cursor: 'pointer' }}
                      size="md"
                    >
                      {row.overdue}
                    </Badge>
                  ) : (
                    <Text c="dimmed">0</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge
                    color="green"
                    variant="light"
                    onClick={(e) => { e.stopPropagation(); openUserDrawer(row, 'completed'); }}
                    style={{ cursor: 'pointer' }}
                    size="md"
                  >
                    {row.completed}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {sorted.length === 0 && (
        <Center mih={200}>
          <Stack align="center">
            <IconUser size={48} stroke={1} style={{ opacity: 0.3 }} />
            <Text c="dimmed">No team members found</Text>
            <Text size="sm" c="dimmed">Try adjusting your filters</Text>
          </Stack>
        </Center>
      )}
    </ContainerBox>
  );

  const CardView = (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="lg" mt={24}>
      {sorted.map(row => (
        <CapacityCard key={row.user.id} member={row} onClick={openUserDrawer} />
      ))}
    </SimpleGrid>
  );

  const KanbanView = (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt={24}>
      {[
        {
          key: 'available',
          title: 'Available',
          color: 'green',
          icon: IconClock,
          filter: (r) => (r.planned_utilization ?? 0) < 90 && (r.availability_hours ?? 0) > 8
        },
        {
          key: 'at-capacity',
          title: 'At Capacity',
          color: 'orange',
          icon: IconTrendingUp,
          filter: (r) => ((r.planned_utilization ?? 0) >= 90 && (r.planned_utilization ?? 0) < 100) || (r.availability_hours ?? 0) <= 8
        },
        {
          key: 'over-capacity',
          title: 'Over Capacity',
          color: 'red',
          icon: IconAlertTriangle,
          filter: (r) => (r.planned_utilization ?? 0) >= 100
        },
      ].map(col => {
        const filtered = sorted.filter(col.filter);
        return (
          <Card key={col.key} withBorder padding="lg" radius="md">
            <Group gap="md" mb="lg">
              <ThemeIcon size="lg" radius="xl" color={col.color} variant="light">
                <col.icon style={{ width: rem(20), height: rem(20) }} />
              </ThemeIcon>
              <Stack gap={2}>
                <Text fw={600} size="lg">{col.title}</Text>
                <Text size="sm" c="dimmed">{filtered.length} members</Text>
              </Stack>
            </Group>

            <Stack gap="md">
              {filtered.map(row => (
                <Card
                  key={row.user.id}
                  withBorder
                  padding="md"
                  radius="sm"
                  onClick={() => openUserDrawer(row)}
                  style={{ cursor: 'pointer', transition: 'all 0.1s ease' }}
                  className="hover:shadow-md"
                >
                  <Group justify="space-between" wrap="nowrap" mb="sm">
                    <Group gap="sm" wrap="nowrap">
                      <Avatar
                        src={row.user.avatar}
                        size={32}
                        radius="xl"
                        onClick={(e) => {
                          e.stopPropagation();
                          redirectTo('users.edit', [row.user.id]);
                        }}
                      />
                      <Stack gap={2}>
                        <Text fw={600} size="sm">{row.user.name}</Text>
                        <Text size="xs" c="dimmed">#{row.rank}</Text>
                      </Stack>
                    </Group>
                    <Badge variant="light" color={col.color}>
                      {row.planned_utilization ?? 0}%
                    </Badge>
                  </Group>

                  <Group gap="xs" justify="space-between">
                    <Group gap="xs">
                      {row.pending > 0 && (
                        <Badge size="xs" variant="light">{row.pending} pending</Badge>
                      )}
                      {row.overdue > 0 && (
                        <Badge size="xs" color="red" variant="light">{row.overdue} overdue</Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">{row.availability_hours?.toFixed(1)}h free</Text>
                  </Group>
                </Card>
              ))}
              {filtered.length === 0 && (
                <Center py="xl">
                  <Stack align="center">
                    <col.icon size={32} stroke={1} style={{ opacity: 0.3 }} />
                    <Text size="sm" c="dimmed">No members</Text>
                  </Stack>
                </Center>
              )}
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <div>Reports</div>
        <div>Team capacity</div>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-end" mb="xl">
        <Title order={1}>Team Capacity Planning</Title>
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            {dayjs(meta.start).format('MMM D')} - {dayjs(meta.end).format('MMM D, YYYY')}
          </Text>
          <Badge variant="light" size="lg">
            {meta.capacity_hours?.toFixed(0)}h total capacity
          </Badge>
        </Group>
      </Group>

      <Card withBorder padding="xl" radius="md" mb="xl">
        <form onSubmit={submit}>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="lg">
            <MultiSelect
              label="Team Members"
              placeholder="All members"
              value={form.data.users}
              onChange={values => updateValue('users', values)}
              data={dropdowns.users}
              error={form.errors.users}
            />

            <DatesProvider settings={{ timezone: 'utc' }}>
              <DatePickerInput
                label="Planning Period"
                type="range"
                valueFormat="MMM D"
                placeholder="Select range"
                clearable
                allowSingleDateInRange
                value={form.data.dateRange}
                onChange={dates => updateValue('dateRange', dates)}
              />
            </DatesProvider>

            <NumberInput
              label="Weekly Capacity"
              description="Hours per week"
              allowDecimal={false}
              clampBehavior="strict"
              min={1}
              max={168}
              value={form.data.weekly_capacity}
              onChange={val => updateValue('weekly_capacity', val || 0)}
              error={form.errors.weekly_capacity}
            />

            <div>
              <Text size="sm" fw={500} mb={6}>Ranking Method</Text>
              <SegmentedControl
                value={form.data.rank_by}
                onChange={val => updateValue('rank_by', val)}
                data={[
                  { label: 'Performance', value: 'performance' },
                  { label: 'Planned', value: 'planned' },
                  { label: 'Actual', value: 'actual' },
                ]}
                fullWidth
              />
            </div>

            <div>
              <Text size="sm" fw={500} mb={6}>View Mode</Text>
              <SegmentedControl
                value={form.data.view}
                onChange={val => updateValue('view', val)}
                data={[
                  { label: 'Cards', value: 'cards' },
                  { label: 'Table', value: 'table' },
                  { label: 'Kanban', value: 'kanban' },
                ]}
                fullWidth
              />
            </div>
          </SimpleGrid>

          <Group justify="flex-end" mt="lg">
            <Button type="submit" loading={form.processing} size="md">
              Update Report
            </Button>
          </Group>
        </form>
      </Card>

      {form.data.view === 'table' && TableView}
      {form.data.view === 'cards' && CardView}
      {form.data.view === 'kanban' && KanbanView}

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <Group gap="md">
            <Avatar src={activeUser?.user.avatar} size={32} radius="xl" />
            <Stack gap={2}>
              <Text fw={600}>{activeUser?.user.name}</Text>
              <Text size="xs" c="dimmed">Member Details</Text>
            </Stack>
          </Group>
        }
        size="xl"
        position="right"
      >
        {activeUser && (
          <>
            <Card withBorder padding="lg" radius="md" mb="lg">
              <SimpleGrid cols={2} spacing="lg" mb="lg">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Planned Utilization</Text>
                  <UtilCell value={activeUser.planned_utilization} />
                </Stack>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Actual Utilization</Text>
                  <UtilCell value={activeUser.actual_utilization} />
                </Stack>
              </SimpleGrid>

              <Group justify="space-between" mb="md">
                <Tooltip label="Remaining capacity for new work">
                  <Group gap="xs">
                    <IconClock size={16} />
                    <Text fw={500}>{activeUser.availability_hours?.toFixed(1)} hours available</Text>
                  </Group>
                </Tooltip>
                <Badge variant="light" size="lg">Rank #{activeUser.rank}</Badge>
              </Group>

              <SimpleGrid cols={3} spacing="md">
                <Tooltip label="Click to view pending tasks">
                  <div onClick={() => setActiveTab('pending')} style={{ cursor: 'pointer' }}>
                    <Text size="xs" c="dimmed" ta="center">Pending</Text>
                    <Text size="xl" fw={700} ta="center">{activeUser.pending}</Text>
                  </div>
                </Tooltip>
                <Tooltip label="Click to view overdue tasks">
                  <div onClick={() => setActiveTab('overdue')} style={{ cursor: 'pointer' }}>
                    <Text size="xs" c="dimmed" ta="center">Overdue</Text>
                    <Text size="xl" fw={700} ta="center" c="red">{activeUser.overdue}</Text>
                  </div>
                </Tooltip>
                <Tooltip label="Click to view completed tasks">
                  <div onClick={() => setActiveTab('completed')} style={{ cursor: 'pointer' }}>
                    <Text size="xs" c="dimmed" ta="center">Completed</Text>
                    <Text size="xl" fw={700} ta="center" c="green">{activeUser.completed}</Text>
                  </div>
                </Tooltip>
              </SimpleGrid>
            </Card>

            <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="pending" rightSection={<Badge size="xs">{activeUser.pending}</Badge>}>
                  Pending Tasks
                </Tabs.Tab>
                <Tabs.Tab value="overdue" rightSection={<Badge size="xs" color="red">{activeUser.overdue}</Badge>}>
                  Overdue Tasks
                </Tabs.Tab>
                <Tabs.Tab value="completed" rightSection={<Badge size="xs" color="green">{activeUser.completed}</Badge>}>
                  Completed Tasks
                </Tabs.Tab>
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
  if (loading) {
    return (
      <Center mih={120}>
        <Stack align="center">
          <Text c="dimmed">Loading tasks...</Text>
        </Stack>
      </Center>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center">
          <IconClock size={32} stroke={1} style={{ opacity: 0.3 }} />
          <Text c="dimmed">No tasks found</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      {items.map((task) => (
        <Card
          key={task.id}
          withBorder
          padding="md"
          radius="sm"
          style={{ cursor: 'pointer', transition: 'all 0.1s ease' }}
          onClick={() => redirectTo('projects.tasks.open', [task.project_id, task.id])}
          className="hover:shadow-md"
        >
          <Group justify="space-between" wrap="nowrap" mb="sm">
            <Stack gap={4} style={{ flex: 1 }}>
              <Text fw={600} lineClamp={2}>{task.name}</Text>
              <Group gap="xs">
                <Badge size="sm" variant="light" color="blue">{task.project_name}</Badge>
                {task.estimation && (
                  <Badge size="sm" variant="light" color="gray">
                    {Number(task.estimation).toFixed(1)}h est.
                  </Badge>
                )}
              </Group>
            </Stack>
            {task.due_on && (
              <Tooltip label={`Due ${dayjs(task.due_on).format('MMM D, YYYY')}`}>
                <Badge
                  size="sm"
                  color={dayjs(task.due_on).isBefore(dayjs()) ? 'red' : 'orange'}
                  variant="light"
                >
                  {dayjs(task.due_on).format('MMM D')}
                </Badge>
              </Tooltip>
            )}
            {task.completed_at && (
              <Badge size="sm" color="green" variant="light">
                Done {dayjs(task.completed_at).format('MMM D')}
              </Badge>
            )}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

TeamCapacity.layout = page => <Layout title='Team Capacity Planning'>{page}</Layout>;
