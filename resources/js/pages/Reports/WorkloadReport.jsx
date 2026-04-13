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
  Pagination,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import {
  IconUsers,
  IconAlertTriangle,
  IconClock,
  IconChevronDown,
  IconChevronRight,
  IconFolder,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

function WorkloadBar({ value, max, color = 'blue' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <Tooltip label={`${value} of ${max}`}>
      <Stack gap={4} style={{ minWidth: 80 }}>
        <Text size="xs" fw={500}>{value}</Text>
        <Progress value={pct} color={color} size="sm" radius="xl" />
      </Stack>
    </Tooltip>
  );
}

const MEMBERS_PER_PAGE = 15;

const WorkloadReport = () => {
  const { members, dropdowns } = usePage().props;
  const params = currentUrlParams();
  const computedColorScheme = useComputedColorScheme();
  const isDark = computedColorScheme === 'dark';
  const expandedBg = isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)';

  const [form, submit, updateValue] = useForm('get', route('reports.workload-report'), {
    users: params.users?.map(String) || [],
    projects: params.projects?.map(String) || [],
    dateRange:
      params.dateRange && params.dateRange[0] && params.dateRange[1]
        ? [dayjs(params.dateRange[0]).toDate(), dayjs(params.dateRange[1]).toDate()]
        : [null, null],
  });

  const [expanded, setExpanded] = useState({});
  const toggleExpand = (userId) => setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));
  const [memberPage, setMemberPage] = useState(1);

  const maxOpen = useMemo(() => Math.max(1, ...members.map((m) => m.total_open)), [members]);

  const summary = useMemo(() => {
    const totalOpen = members.reduce((s, m) => s + m.total_open, 0);
    const totalOverdue = members.reduce((s, m) => s + m.total_overdue, 0);
    const totalDone = members.reduce((s, m) => s + m.total_completed, 0);
    const totalEstimated = members.reduce((s, m) => s + m.estimated_hours, 0);
    const totalLogged = members.reduce((s, m) => s + m.time_logged, 0);
    const totalHighPri = members.reduce((s, m) => s + m.high_priority, 0);
    return { totalOpen, totalOverdue, totalDone, totalEstimated: Math.round(totalEstimated * 10) / 10, totalLogged: Math.round(totalLogged * 10) / 10, totalHighPri };
  }, [members]);

  const getWorkloadColor = (member) => {
    if (member.total_overdue > 3 || member.high_priority > 5) return 'red';
    if (member.total_open > 20 || member.total_overdue > 0) return 'orange';
    if (member.total_open > 10) return 'yellow';
    return 'green';
  };

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <Text onClick={() => redirectTo('dashboard')} style={{ cursor: 'pointer' }}>Dashboard</Text>
        <Text>Reports</Text>
        <Text>Workload report</Text>
      </Breadcrumbs>

      <Title order={1} mb={20}>Workload Report</Title>

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
                  label="Date range (for completed/logged)"
                  placeholder="All time"
                  clearable
                  miw={260}
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
        <SimpleGrid cols={{ base: 2, md: 6 }} spacing="md" mb={20}>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total open</Text>
            <Text fw={700} size="xl" c="blue">{summary.totalOpen}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Overdue</Text>
            <Text fw={700} size="xl" c="red">{summary.totalOverdue}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Completed</Text>
            <Text fw={700} size="xl" c="green">{summary.totalDone}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Estimated hours</Text>
            <Group gap="xs"><IconClock size={18} /><Text fw={700} size="xl">{summary.totalEstimated}h</Text></Group>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Time logged</Text>
            <Group gap="xs"><IconClock size={18} /><Text fw={700} size="xl">{summary.totalLogged}h</Text></Group>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>High priority</Text>
            <Group gap="xs"><IconAlertTriangle size={18} /><Text fw={700} size="xl" c="red">{summary.totalHighPri}</Text></Group>
          </Card>
        </SimpleGrid>
      )}

      {/* Workload table */}
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
          <>
          <Table.ScrollContainer minWidth={1300}>
            <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Member</Table.Th>
                  <Table.Th><Tooltip label="Open tasks"><Text size="sm" fw={600}>Open tasks</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Open subtasks"><Text size="sm" fw={600}>Open subtasks</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Total open (tasks + subtasks)"><Text size="sm" fw={600}>Total open</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Overdue tasks + subtasks"><Text size="sm" fw={600}>Overdue</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Due within 7 days"><Text size="sm" fw={600}>Due soon</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="High/urgent priority open"><Text size="sm" fw={600}>High priority</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Completed tasks + subtasks"><Text size="sm" fw={600}>Completed</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Estimated hours of open work"><Text size="sm" fw={600}>Est. hours</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Time logged"><Text size="sm" fw={600}>Logged</Text></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Active projects"><Text size="sm" fw={600}>Projects</Text></Tooltip></Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {members.slice((memberPage - 1) * MEMBERS_PER_PAGE, memberPage * MEMBERS_PER_PAGE).map((member) => {
                  const isOpen = expanded[member.user.id];
                  const wColor = getWorkloadColor(member);
                  return (
                    <>
                      <Table.Tr key={member.user.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(member.user.id)}>
                        <Table.Td>
                          <Group gap="md" wrap="nowrap">
                            <Avatar src={member.user.avatar} size={40} radius="xl" />
                            <Stack gap={2}>
                              <Text fw={600}>{member.user.name}</Text>
                              <Badge size="xs" color={wColor} variant="light">
                                {wColor === 'red' ? 'Overloaded' : wColor === 'orange' ? 'Heavy' : wColor === 'yellow' ? 'Moderate' : 'Light'}
                              </Badge>
                            </Stack>
                          </Group>
                        </Table.Td>
                        <Table.Td><Text fw={500}>{member.open_tasks}</Text></Table.Td>
                        <Table.Td><Text fw={500}>{member.open_subtasks}</Text></Table.Td>
                        <Table.Td>
                          <WorkloadBar value={member.total_open} max={maxOpen} color={wColor} />
                        </Table.Td>
                        <Table.Td>
                          {member.total_overdue > 0 ? (
                            <Badge color="red" variant="light" size="lg">{member.total_overdue}</Badge>
                          ) : (
                            <Text c="dimmed" size="sm">0</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {member.due_soon > 0 ? (
                            <Badge color="orange" variant="light" size="lg">{member.due_soon}</Badge>
                          ) : (
                            <Text c="dimmed" size="sm">0</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {member.high_priority > 0 ? (
                            <Badge color="red" variant="light" size="lg">{member.high_priority}</Badge>
                          ) : (
                            <Text c="dimmed" size="sm">0</Text>
                          )}
                        </Table.Td>
                        <Table.Td><Badge color="green" variant="light" size="lg">{member.total_completed}</Badge></Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <IconClock size={16} />
                            <Text fw={500}>{member.estimated_hours}h</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td><Text fw={500}>{member.time_logged}h</Text></Table.Td>
                        <Table.Td><Text fw={500}>{member.projects_count}</Text></Table.Td>
                        <Table.Td>
                          {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                        </Table.Td>
                      </Table.Tr>

                      {/* Expanded: per-project breakdown */}
                      <Table.Tr key={`${member.user.id}-detail`} style={{ display: isOpen ? undefined : 'none' }}>
                        <Table.Td colSpan={12} style={{ background: expandedBg, padding: '16px 24px' }}>
                          <Text fw={600} mb="xs" size="sm">
                            <Group gap={4}><IconFolder size={16} /> Project breakdown</Group>
                          </Text>
                          {(!member.project_breakdown || member.project_breakdown.length === 0) ? (
                            <Text c="dimmed" size="sm">No project data available.</Text>
                          ) : (
                            <Table verticalSpacing="xs" horizontalSpacing="sm" withRowBorders={false}>
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>Project</Table.Th>
                                  <Table.Th>Open tasks</Table.Th>
                                  <Table.Th>Done tasks</Table.Th>
                                  <Table.Th>Open est. hours</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {member.project_breakdown.map((pb) => (
                                  <Table.Tr key={pb.project_id}>
                                    <Table.Td>
                                      <Group gap="xs">
                                        <IconFolder size={14} />
                                        <Text size="sm" fw={500}>{pb.project_name}</Text>
                                      </Group>
                                    </Table.Td>
                                    <Table.Td><Badge color="orange" variant="light" size="sm">{pb.open_tasks}</Badge></Table.Td>
                                    <Table.Td><Badge color="green" variant="light" size="sm">{pb.done_tasks}</Badge></Table.Td>
                                    <Table.Td><Text size="sm">{pb.open_hours}h</Text></Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    </>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {/* Member-level pagination */}
          {members.length > MEMBERS_PER_PAGE && (
            <Group justify="space-between" mt="md" px="md">
              <Text size="sm" c="dimmed">
                Showing {((memberPage - 1) * MEMBERS_PER_PAGE) + 1}–{Math.min(memberPage * MEMBERS_PER_PAGE, members.length)} of {members.length} members
              </Text>
              <Pagination size="sm" total={Math.ceil(members.length / MEMBERS_PER_PAGE)} value={memberPage} onChange={setMemberPage} />
            </Group>
          )}
          </>
        )}
      </ContainerBox>
    </>
  );
};

WorkloadReport.layout = (page) => <Layout title="Workload report">{page}</Layout>;

export default WorkloadReport;

