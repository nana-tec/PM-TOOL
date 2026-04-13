import EmptyWithIcon from '@/components/EmptyWithIcon';
import useForm from '@/hooks/useForm';
import ContainerBox from '@/layouts/ContainerBox';
import Layout from '@/layouts/MainLayout';
import { currentUrlParams, redirectTo } from '@/utils/route';
import { usePage } from '@inertiajs/react';
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Center,
  Group,
  MultiSelect,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
  ThemeIcon,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import {
  IconChevronDown,
  IconChevronRight,
  IconSubtask,
  IconUsers,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

function StatusBadge({ completed_at }) {
  return completed_at ? (
    <Badge color="green" variant="light" size="sm">Done</Badge>
  ) : (
    <Badge color="orange" variant="light" size="sm">Pending</Badge>
  );
}

function RankBadge({ rank }) {
  const color = rank === 1 ? 'yellow' : rank === 2 ? 'gray' : rank === 3 ? 'orange' : 'blue';
  return (
    <ThemeIcon size="lg" radius="xl" color={color} variant="light">
      <Text fw={700} size="sm">#{rank}</Text>
    </ThemeIcon>
  );
}

const MemberReport = () => {
  const { members, dropdowns } = usePage().props;
  const params = currentUrlParams();

  const [form, submit, updateValue] = useForm('get', route('reports.member-report'), {
    users: params.users?.map(String) || [],
    projects: params.projects?.map(String) || [],
    dateRange:
      params.dateRange && params.dateRange[0] && params.dateRange[1]
        ? [dayjs(params.dateRange[0]).toDate(), dayjs(params.dateRange[1]).toDate()]
        : [null, null],
  });

  const [expanded, setExpanded] = useState({});
  const toggleExpand = (userId) => setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));

  const [taskFilter, setTaskFilter] = useState('all'); // all | pending | completed

  const filteredTasksFor = (member) => {
    const tasks = member.tasks || [];
    if (taskFilter === 'pending') return tasks.filter((t) => !t.completed_at);
    if (taskFilter === 'completed') return tasks.filter((t) => t.completed_at);
    return tasks;
  };

  const filteredSubtasksFor = (member) => {
    const subs = member.subtasks || [];
    if (taskFilter === 'pending') return subs.filter((s) => !s.completed_at);
    if (taskFilter === 'completed') return subs.filter((s) => s.completed_at);
    return subs;
  };

  // Summary stats
  const summary = useMemo(() => {
    const totalCompleted = members.reduce((s, m) => s + m.total_completed, 0);
    const totalPending = members.reduce((s, m) => s + m.total_pending, 0);
    const totalOverdue = members.reduce((s, m) => s + m.tasks_overdue, 0);
    const totalMembers = members.length;
    return { totalCompleted, totalPending, totalOverdue, totalMembers };
  }, [members]);

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <Text onClick={() => redirectTo('dashboard')} style={{ cursor: 'pointer' }}>Dashboard</Text>
        <Text>Reports</Text>
        <Text>Member report</Text>
      </Breadcrumbs>

      <Title order={1} mb={20}>Member Report</Title>

      {/* Filters */}
      <ContainerBox px={35} py={25} mb={20}>
        <form onSubmit={submit}>
          <Group justify="space-between" align="flex-end">
            <Group gap="xl" wrap="wrap">
              <MultiSelect
                label="Members"
                placeholder={form.data.users.length ? null : 'All members'}
                w={240}
                value={form.data.users}
                onChange={(v) => updateValue('users', v)}
                data={dropdowns.users}
                searchable
                clearable
              />
              <MultiSelect
                label="Projects"
                placeholder={form.data.projects.length ? null : 'All projects'}
                w={240}
                value={form.data.projects}
                onChange={(v) => updateValue('projects', v)}
                data={dropdowns.projects}
                searchable
                clearable
              />
              <DatesProvider settings={{ firstDayOfWeek: 1 }}>
                <DatePickerInput
                  type="range"
                  label="Date range"
                  placeholder="All time"
                  clearable
                  miw={240}
                  value={form.data.dateRange}
                  onChange={(dates) => updateValue('dateRange', dates)}
                />
              </DatesProvider>
            </Group>
            <Button type="submit" disabled={form.processing}>Apply</Button>
          </Group>
        </form>
      </ContainerBox>

      {/* Summary cards */}
      {members.length > 0 && (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb={20}>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Team members</Text>
            <Group gap="xs" mt={4}><IconUsers size={20} /><Text fw={700} size="xl">{summary.totalMembers}</Text></Group>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total completed</Text>
            <Text fw={700} size="xl" c="green">{summary.totalCompleted}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total pending</Text>
            <Text fw={700} size="xl" c="orange">{summary.totalPending}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Overdue tasks</Text>
            <Text fw={700} size="xl" c="red">{summary.totalOverdue}</Text>
          </Card>
        </SimpleGrid>
      )}

      {/* Task filter toggle */}
      {members.length > 0 && (
        <Group mb={12} gap="sm">
          <Text size="sm" fw={500}>Task list filter:</Text>
          {['all', 'pending', 'completed'].map((f) => (
            <Badge
              key={f}
              variant={taskFilter === f ? 'filled' : 'light'}
              style={{ cursor: 'pointer' }}
              onClick={() => setTaskFilter(f)}
              tt="capitalize"
            >
              {f}
            </Badge>
          ))}
        </Group>
      )}

      {/* Member table */}
      <ContainerBox px="md" py="md">
        {members.length === 0 ? (
          <Center mih={200}>
            <EmptyWithIcon
              title="No data"
              subtitle="No members found for the selected filters"
              icon={IconUsers}
            />
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={1100}>
            <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Rank</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Tasks completed</Table.Th>
                  <Table.Th>Tasks pending</Table.Th>
                  <Table.Th>Subtasks done</Table.Th>
                  <Table.Th>Subtasks pending</Table.Th>
                  <Table.Th>Completion %</Table.Th>
                  <Table.Th>Overdue</Table.Th>
                  <Table.Th>Nearest due</Table.Th>
                  <Table.Th>Projects</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {members.map((member) => {
                  const isOpen = expanded[member.user.id];
                  const tasks = filteredTasksFor(member);
                  const subtasks = filteredSubtasksFor(member);
                  return (
                    <>
                      <Table.Tr key={member.user.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(member.user.id)}>
                        <Table.Td><RankBadge rank={member.rank} /></Table.Td>
                        <Table.Td>
                          <Group gap="md" wrap="nowrap">
                            <Avatar src={member.user.avatar} size={40} radius="xl" />
                            <Stack gap={2}>
                              <Text fw={600}>{member.user.name}</Text>
                              <Text size="xs" c="dimmed">{member.projects_count} project{member.projects_count !== 1 ? 's' : ''}</Text>
                            </Stack>
                          </Group>
                        </Table.Td>
                        <Table.Td><Badge color="green" variant="light" size="lg">{member.tasks_completed}</Badge></Table.Td>
                        <Table.Td><Badge color="orange" variant="light" size="lg">{member.tasks_pending}</Badge></Table.Td>
                        <Table.Td><Badge color="teal" variant="light" size="lg">{member.subtasks_completed}</Badge></Table.Td>
                        <Table.Td><Badge color="yellow" variant="light" size="lg">{member.subtasks_pending}</Badge></Table.Td>
                        <Table.Td>
                          <Stack gap={4} style={{ minWidth: 100 }}>
                            <Text size="sm" fw={600} c={member.completion_rate >= 80 ? 'green' : member.completion_rate >= 50 ? 'orange' : 'red'}>
                              {member.completion_rate}%
                            </Text>
                            <Progress value={member.completion_rate} color={member.completion_rate >= 80 ? 'green' : member.completion_rate >= 50 ? 'orange' : 'red'} size="sm" radius="xl" />
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          {member.tasks_overdue > 0 ? (
                            <Badge color="red" variant="light" size="lg">{member.tasks_overdue}</Badge>
                          ) : (
                            <Text c="dimmed" size="sm">0</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {member.nearest_due ? (
                            <Tooltip label="Nearest due date">
                              <Badge variant="light" color={dayjs(member.nearest_due).isBefore(dayjs()) ? 'red' : 'blue'}>
                                {dayjs(member.nearest_due).format('MMM D, YYYY')}
                              </Badge>
                            </Tooltip>
                          ) : (
                            <Text c="dimmed" size="sm">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td><Text fw={500}>{member.projects_count}</Text></Table.Td>
                        <Table.Td>
                          {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                        </Table.Td>
                      </Table.Tr>

                      {/* Expanded: task + subtask list */}
                      <Table.Tr key={`${member.user.id}-detail`} style={{ display: isOpen ? undefined : 'none' }}>
                        <Table.Td colSpan={11} style={{ background: 'var(--mantine-color-gray-0)', padding: '16px 24px' }}>
                          <Text fw={600} mb="xs" size="sm">Tasks ({tasks.length})</Text>
                          {tasks.length === 0 ? (
                            <Text c="dimmed" size="sm">No tasks match filter.</Text>
                          ) : (
                            <Table verticalSpacing="xs" horizontalSpacing="sm" withRowBorders={false}>
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>Task</Table.Th>
                                  <Table.Th>Project</Table.Th>
                                  <Table.Th>Priority</Table.Th>
                                  <Table.Th>Due date</Table.Th>
                                  <Table.Th>Status</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {tasks.slice(0, 50).map((t) => (
                                  <Table.Tr key={t.id}>
                                    <Table.Td><Text size="sm">{t.name}</Text></Table.Td>
                                    <Table.Td><Text size="sm" c="dimmed">{t.project_name}</Text></Table.Td>
                                    <Table.Td>
                                      <Badge size="xs" variant="outline" color={t.priority === 'urgent' ? 'red' : t.priority === 'high' ? 'orange' : 'gray'}>
                                        {t.priority || '—'}
                                      </Badge>
                                    </Table.Td>
                                    <Table.Td><Text size="sm">{t.due_on ? dayjs(t.due_on).format('MMM D, YYYY') : '—'}</Text></Table.Td>
                                    <Table.Td><StatusBadge completed_at={t.completed_at} /></Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          )}
                          {tasks.length > 50 && <Text size="xs" c="dimmed" mt="xs">Showing 50 of {tasks.length} tasks</Text>}

                          <Text fw={600} mt="md" mb="xs" size="sm">
                            <Group gap={4}><IconSubtask size={16} /> Subtasks ({subtasks.length})</Group>
                          </Text>
                          {subtasks.length === 0 ? (
                            <Text c="dimmed" size="sm">No subtasks match filter.</Text>
                          ) : (
                            <Table verticalSpacing="xs" horizontalSpacing="sm" withRowBorders={false}>
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>Subtask</Table.Th>
                                  <Table.Th>Parent task</Table.Th>
                                  <Table.Th>Project</Table.Th>
                                  <Table.Th>Due date</Table.Th>
                                  <Table.Th>Status</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {subtasks.slice(0, 50).map((s) => (
                                  <Table.Tr key={s.id}>
                                    <Table.Td><Text size="sm">{s.name}</Text></Table.Td>
                                    <Table.Td><Text size="sm" c="dimmed">{s.parent_task_name}</Text></Table.Td>
                                    <Table.Td><Text size="sm" c="dimmed">{s.project_name}</Text></Table.Td>
                                    <Table.Td><Text size="sm">{s.due_on ? dayjs(s.due_on).format('MMM D, YYYY') : '—'}</Text></Table.Td>
                                    <Table.Td><StatusBadge completed_at={s.completed_at} /></Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          )}
                          {subtasks.length > 50 && <Text size="xs" c="dimmed" mt="xs">Showing 50 of {subtasks.length} subtasks</Text>}
                        </Table.Td>
                      </Table.Tr>
                    </>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </ContainerBox>
    </>
  );
};

MemberReport.layout = (page) => <Layout title="Member report">{page}</Layout>;

export default MemberReport;

