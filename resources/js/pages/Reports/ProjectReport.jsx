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
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
  AvatarGroup,
  useComputedColorScheme,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import {
  IconFolder,
  IconChevronDown,
  IconChevronRight,
  IconSubtask,
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

const ITEMS_PER_PAGE = 10;
const PROJECTS_PER_PAGE = 15;

const ProjectReport = () => {
  const { projects, dropdowns } = usePage().props;
  const params = currentUrlParams();
  const computedColorScheme = useComputedColorScheme();
  const isDark = computedColorScheme === 'dark';
  const expandedBg = isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)';

  const [form, submit, updateValue] = useForm('get', route('reports.project-report'), {
    projects: params.projects?.map(String) || [],
    dateRange:
      params.dateRange && params.dateRange[0] && params.dateRange[1]
        ? [dayjs(params.dateRange[0]).toDate(), dayjs(params.dateRange[1]).toDate()]
        : [null, null],
  });

  const [expanded, setExpanded] = useState({});
  const toggleExpand = (projectId) => setExpanded((prev) => ({ ...prev, [projectId]: !prev[projectId] }));

  const [taskFilter, setTaskFilter] = useState('all');
  const [taskPages, setTaskPages] = useState({});
  const [subPages, setSubPages] = useState({});
  const [projectPage, setProjectPage] = useState(1);

  const filteredTasks = (proj) => {
    const tasks = proj.tasks || [];
    if (taskFilter === 'pending') return tasks.filter((t) => !t.completed_at);
    if (taskFilter === 'completed') return tasks.filter((t) => t.completed_at);
    return tasks;
  };

  const filteredSubtasks = (proj) => {
    const subs = proj.subtasks || [];
    if (taskFilter === 'pending') return subs.filter((s) => !s.completed_at);
    if (taskFilter === 'completed') return subs.filter((s) => s.completed_at);
    return subs;
  };

  const summary = useMemo(() => {
    const totalProjects = projects.length;
    const totalCompleted = projects.reduce((s, p) => s + p.total_completed, 0);
    const totalPending = projects.reduce((s, p) => s + (p.tasks_pending + p.subtasks_pending), 0);
    const totalOverdue = projects.reduce((s, p) => s + p.tasks_overdue, 0);
    const avgProgress = totalProjects > 0 ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / totalProjects) : 0;
    return { totalProjects, totalCompleted, totalPending, totalOverdue, avgProgress };
  }, [projects]);

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <Text onClick={() => redirectTo('dashboard')} style={{ cursor: 'pointer' }}>Dashboard</Text>
        <Text>Reports</Text>
        <Text>Project report</Text>
      </Breadcrumbs>

      <Title order={1} mb={20}>Project Report</Title>

      {/* Filters */}
      <ContainerBox px={35} py={25} mb={20}>
        <form onSubmit={submit}>
          <Group justify="space-between" align="flex-end">
            <Group gap="xl" wrap="wrap">
              <MultiSelect
                label="Projects"
                placeholder={form.data.projects.length ? null : 'All projects'}
                w={300}
                value={form.data.projects}
                onChange={(v) => updateValue('projects', v)}
                data={dropdowns.projects}
                searchable
                clearable
              />
              <DatesProvider settings={{ firstDayOfWeek: 1 }}>
                <DatePickerInput
                  type="range"
                  label="Date range (completed within)"
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

      {/* Summary */}
      {projects.length > 0 && (
        <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md" mb={20}>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Projects</Text>
            <Text fw={700} size="xl">{summary.totalProjects}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Completed items</Text>
            <Text fw={700} size="xl" c="green">{summary.totalCompleted}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pending items</Text>
            <Text fw={700} size="xl" c="orange">{summary.totalPending}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Overdue tasks</Text>
            <Text fw={700} size="xl" c="red">{summary.totalOverdue}</Text>
          </Card>
          <Card withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Avg progress</Text>
            <Group gap="xs">
              <Text fw={700} size="xl">{summary.avgProgress}%</Text>
            </Group>
          </Card>
        </SimpleGrid>
      )}

      {/* Task filter */}
      {projects.length > 0 && (
        <Group mb={12} gap="md">
          <Text size="sm" fw={500}>Filter tasks:</Text>
          <SegmentedControl
            size="xs"
            value={taskFilter}
            onChange={setTaskFilter}
            data={[
              { label: 'All', value: 'all' },
              { label: 'Pending', value: 'pending' },
              { label: 'Completed', value: 'completed' },
            ]}
          />
        </Group>
      )}

      {/* Project table */}
      <ContainerBox px="md" py="md">
        {projects.length === 0 ? (
          <Center mih={200}>
            <EmptyWithIcon
              title="No data"
              subtitle="No projects found for the selected filters"
              icon={IconFolder}
            />
          </Center>
        ) : (
          <>
          <Table.ScrollContainer minWidth={1200}>
            <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Project</Table.Th>
                  <Table.Th>Members</Table.Th>
                  <Table.Th>Tasks done</Table.Th>
                  <Table.Th>Tasks pending</Table.Th>
                  <Table.Th>Subtasks done</Table.Th>
                  <Table.Th>Subtasks pending</Table.Th>
                  <Table.Th>Overdue</Table.Th>
                  <Table.Th>Progress</Table.Th>
                  <Table.Th>Nearest due</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {projects.slice((projectPage - 1) * PROJECTS_PER_PAGE, projectPage * PROJECTS_PER_PAGE).map((proj) => {
                  const isOpen = expanded[proj.project.id];
                  const tasks = filteredTasks(proj);
                  const subtasks = filteredSubtasks(proj);
                  return (
                    <>
                      <Table.Tr key={proj.project.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(proj.project.id)}>
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            <IconFolder size={20} />
                            <Stack gap={2}>
                              <Group gap="xs">
                                <Text fw={600}>{proj.project.name}</Text>
                                {proj.sub_projects && proj.sub_projects.length > 0 && (
                                  <Tooltip label={`Includes ${proj.sub_projects.length} sub-project${proj.sub_projects.length > 1 ? 's' : ''}: ${proj.sub_projects.map(sp => sp.name).join(', ')}`}>
                                    <Badge size="xs" variant="light" color="grape">{proj.sub_projects.length} sub</Badge>
                                  </Tooltip>
                                )}
                              </Group>
                              <Text size="xs" c="dimmed">{proj.total_items} total items</Text>
                            </Stack>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {proj.members.length > 0 ? (
                            <Tooltip label={proj.members.map((m) => m.name).join(', ')}>
                              <AvatarGroup>
                                {proj.members.slice(0, 4).map((m) => (
                                  <Avatar key={m.id} src={m.avatar} size={32} radius="xl" />
                                ))}
                                {proj.members.length > 4 && (
                                  <Avatar size={32} radius="xl">+{proj.members.length - 4}</Avatar>
                                )}
                              </AvatarGroup>
                            </Tooltip>
                          ) : (
                            <Text c="dimmed" size="sm">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td><Badge color="green" variant="light" size="lg">{proj.tasks_completed}</Badge></Table.Td>
                        <Table.Td><Badge color="orange" variant="light" size="lg">{proj.tasks_pending}</Badge></Table.Td>
                        <Table.Td><Badge color="teal" variant="light" size="lg">{proj.subtasks_completed}</Badge></Table.Td>
                        <Table.Td><Badge color="yellow" variant="light" size="lg">{proj.subtasks_pending}</Badge></Table.Td>
                        <Table.Td>
                          {proj.tasks_overdue > 0 ? (
                            <Badge color="red" variant="light" size="lg">{proj.tasks_overdue}</Badge>
                          ) : (
                            <Text c="dimmed" size="sm">0</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={4} style={{ minWidth: 120 }}>
                            <Text size="sm" fw={600}>{proj.progress}%</Text>
                            <Progress
                              value={proj.progress}
                              color={proj.progress >= 80 ? 'green' : proj.progress >= 50 ? 'blue' : proj.progress >= 25 ? 'orange' : 'red'}
                              size="md"
                              radius="xl"
                            />
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          {proj.nearest_due ? (
                            <Badge variant="light" color={dayjs(proj.nearest_due).isBefore(dayjs()) ? 'red' : 'blue'}>
                              {dayjs(proj.nearest_due).format('MMM D, YYYY')}
                            </Badge>
                          ) : (
                            <Text c="dimmed" size="sm">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                        </Table.Td>
                      </Table.Tr>

                      {/* Expanded rows: tasks + subtasks */}
                      <Table.Tr key={`${proj.project.id}-detail`} style={{ display: isOpen ? undefined : 'none' }}>
                        <Table.Td colSpan={10} style={{ background: expandedBg, padding: '16px 24px' }}>
                          {/* Sub-projects */}
                          {proj.sub_projects && proj.sub_projects.length > 0 && (
                            <Group gap="xs" mb="sm">
                              <Text size="xs" fw={600} c="dimmed">Sub-projects:</Text>
                              {proj.sub_projects.map((sp) => (
                                <Badge key={sp.id} size="xs" variant="light" color="grape">{sp.name}</Badge>
                              ))}
                            </Group>
                          )}

                          <Text fw={600} mb="xs" size="sm">Tasks ({tasks.length})</Text>
                          {tasks.length === 0 ? (
                            <Text c="dimmed" size="sm">No tasks match filter.</Text>
                          ) : (
                            <>
                              <Table verticalSpacing="xs" horizontalSpacing="sm" withRowBorders={false}>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Task</Table.Th>
                                    <Table.Th>Assignee</Table.Th>
                                    <Table.Th>Project</Table.Th>
                                    <Table.Th>Priority</Table.Th>
                                    <Table.Th>Due date</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {tasks.slice(((taskPages[proj.project.id] || 1) - 1) * ITEMS_PER_PAGE, (taskPages[proj.project.id] || 1) * ITEMS_PER_PAGE).map((t) => (
                                    <Table.Tr key={t.id}>
                                      <Table.Td><Text size="sm">{t.name}</Text></Table.Td>
                                      <Table.Td>
                                        {t.assignee_name ? (
                                          <Group gap="xs" wrap="nowrap">
                                            <Avatar src={t.assignee_avatar} size={24} radius="xl" />
                                            <Text size="sm">{t.assignee_name}</Text>
                                          </Group>
                                        ) : (
                                          <Text c="dimmed" size="sm">Unassigned</Text>
                                        )}
                                      </Table.Td>
                                      <Table.Td><Text size="xs" c="dimmed">{t.project_name}</Text></Table.Td>
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
                              {tasks.length > ITEMS_PER_PAGE && (
                                <Group justify="space-between" mt="xs">
                                  <Text size="xs" c="dimmed">Showing {Math.min(tasks.length, ITEMS_PER_PAGE)} of {tasks.length}</Text>
                                  <Pagination size="xs" total={Math.ceil(tasks.length / ITEMS_PER_PAGE)} value={taskPages[proj.project.id] || 1} onChange={(p) => setTaskPages((prev) => ({ ...prev, [proj.project.id]: p }))} />
                                </Group>
                              )}
                            </>
                          )}

                          <Text fw={600} mt="md" mb="xs" size="sm">
                            <Group gap={4}><IconSubtask size={16} /> Subtasks ({subtasks.length})</Group>
                          </Text>
                          {subtasks.length === 0 ? (
                            <Text c="dimmed" size="sm">No subtasks match filter.</Text>
                          ) : (
                            <>
                              <Table verticalSpacing="xs" horizontalSpacing="sm" withRowBorders={false}>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Subtask</Table.Th>
                                    <Table.Th>Parent task</Table.Th>
                                    <Table.Th>Assignee</Table.Th>
                                    <Table.Th>Project</Table.Th>
                                    <Table.Th>Due date</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {subtasks.slice(((subPages[proj.project.id] || 1) - 1) * ITEMS_PER_PAGE, (subPages[proj.project.id] || 1) * ITEMS_PER_PAGE).map((s) => (
                                    <Table.Tr key={s.id}>
                                      <Table.Td><Text size="sm">{s.name}</Text></Table.Td>
                                      <Table.Td><Text size="sm" c="dimmed">{s.parent_task_name}</Text></Table.Td>
                                      <Table.Td>
                                        {s.assignee_name ? (
                                          <Text size="sm">{s.assignee_name}</Text>
                                        ) : (
                                          <Text c="dimmed" size="sm">Unassigned</Text>
                                        )}
                                      </Table.Td>
                                      <Table.Td><Text size="xs" c="dimmed">{s.project_name}</Text></Table.Td>
                                      <Table.Td><Text size="sm">{s.due_on ? dayjs(s.due_on).format('MMM D, YYYY') : '—'}</Text></Table.Td>
                                      <Table.Td><StatusBadge completed_at={s.completed_at} /></Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                              {subtasks.length > ITEMS_PER_PAGE && (
                                <Group justify="space-between" mt="xs">
                                  <Text size="xs" c="dimmed">Showing {Math.min(subtasks.length, ITEMS_PER_PAGE)} of {subtasks.length}</Text>
                                  <Pagination size="xs" total={Math.ceil(subtasks.length / ITEMS_PER_PAGE)} value={subPages[proj.project.id] || 1} onChange={(p) => setSubPages((prev) => ({ ...prev, [proj.project.id]: p }))} />
                                </Group>
                              )}
                            </>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    </>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {/* Project-level pagination */}
          {projects.length > PROJECTS_PER_PAGE && (
            <Group justify="space-between" mt="md" px="md">
              <Text size="sm" c="dimmed">
                Showing {((projectPage - 1) * PROJECTS_PER_PAGE) + 1}–{Math.min(projectPage * PROJECTS_PER_PAGE, projects.length)} of {projects.length} projects
              </Text>
              <Pagination size="sm" total={Math.ceil(projects.length / PROJECTS_PER_PAGE)} value={projectPage} onChange={setProjectPage} />
            </Group>
          )}
          </>
        )}
      </ContainerBox>
    </>
  );
};

ProjectReport.layout = (page) => <Layout title="Project report">{page}</Layout>;

export default ProjectReport;

