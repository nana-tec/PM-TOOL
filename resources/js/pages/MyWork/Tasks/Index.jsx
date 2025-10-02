import EmptyWithIcon from "@/components/EmptyWithIcon";
import Layout from "@/layouts/MainLayout";
import { usePage } from "@inertiajs/react";
import { redirectTo } from "@/utils/route";
import {
  Accordion,
  Box,
  Breadcrumbs,
  Center,
  Stack,
  Text,
  Title,
  rem,
  Group,
  Badge,
  Select,
  Card,
  ActionIcon,
  Tooltip,
  Avatar,
  Grid,
  SegmentedControl,
  Switch
} from "@mantine/core";
import {
  IconRocket,
  IconStar,
  IconStarFilled,
  IconTags,
  IconCalendar,
  IconGridDots,
  IconTable,
  IconLayoutKanban,
  IconLayoutList,
  IconClock,
  IconCalendarDue
} from "@tabler/icons-react";
import { useState, useMemo } from "react";
import Task from "./Task";
import classes from "./css/Index.module.css";
import GanttChart from "@/components/GanttChart";

const TasksIndex = () => {
  let { projects } = usePage().props;

  const [viewMode, setViewMode] = useState('list'); // 'list', 'kanban', 'gantt'
  const [groupBy, setGroupBy] = useState('project'); // 'project', 'labels', 'dates'
  const [sortBy, setSortBy] = useState('priority'); // 'priority', 'date', 'alphabetical'
  const [ganttZoom, setGanttZoom] = useState('month'); // 'week' | 'month' | 'quarter'
  const [ganttGroupByProject, setGanttGroupByProject] = useState(true);

  projects = projects.filter((i) => i.tasks.length);

  // Extract all tasks with enhanced data
  const allTasks = useMemo(() => {
    return projects.flatMap(project =>
      project.tasks.map(task => ({
        ...task,
        project_name: project.name,
        project_id: project.id,
        project_favorite: project.favorite,
        // Enhanced priority calculation
        priority_score: calculatePriorityScore(task),
        days_until_due: task.due_on ? Math.ceil((new Date(task.due_on) - new Date()) / (1000 * 60 * 60 * 24)) : null
      }))
    );
  }, [projects]);

  // Group tasks by different criteria
  const groupedTasks = useMemo(() => {
    switch (groupBy) {
      case 'labels':
        return groupTasksByLabels(allTasks);
      case 'dates':
        return groupTasksByDates(allTasks);
      case 'project':
      default:
        return groupTasksByProject(projects, sortBy);
    }
  }, [allTasks, projects, groupBy, sortBy]);

  function calculatePriorityScore(task) {
    let score = 0;

    // Overdue tasks get highest priority
    if (task.due_on && new Date(task.due_on) < new Date() && !task.completed_at) {
      score += 100;
    }

    // Due soon
    const daysUntilDue = task.due_on ? Math.ceil((new Date(task.due_on) - new Date()) / (1000 * 60 * 60 * 24)) : null;
    if (daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue >= 0) {
      score += 50 - (daysUntilDue * 15);
    }

    // High-priority labels
    const priorityLabels = task.labels.filter(label =>
      ['urgent', 'high', 'critical', 'important'].some(keyword =>
        label.name.toLowerCase().includes(keyword)
      )
    );
    score += priorityLabels.length * 20;

    // Estimation (higher estimation = potentially more important)
    if (task.estimation) {
      score += Math.min(task.estimation / 2, 10);
    }

    return score;
  }

  function groupTasksByLabels(tasks) {
    const labelGroups = {};
    const noLabelTasks = [];

    tasks.forEach(task => {
      if (task.labels.length === 0) {
        noLabelTasks.push(task);
      } else {
        task.labels.forEach(label => {
          if (!labelGroups[label.id]) {
            labelGroups[label.id] = {
              id: label.id,
              name: label.name,
              color: label.color,
              tasks: []
            };
          }
          labelGroups[label.id].tasks.push(task);
        });
      }
    });

    const sortedGroups = Object.values(labelGroups).sort((a, b) => a.name.localeCompare(b.name));

    if (noLabelTasks.length > 0) {
      sortedGroups.push({
        id: 'no-label',
        name: 'No Labels',
        color: '#868e96',
        tasks: noLabelTasks
      });
    }

    return sortedGroups;
  }

  function groupTasksByDates(tasks) {
    const groups = {
      overdue: { name: 'Overdue', tasks: [], color: '#fa5252' },
      today: { name: 'Due Today', tasks: [], color: '#fd7e14' },
      tomorrow: { name: 'Due Tomorrow', tasks: [], color: '#fab005' },
      thisWeek: { name: 'This Week', tasks: [], color: '#51cf66' },
      later: { name: 'Later', tasks: [], color: '#868e96' },
      noDueDate: { name: 'No Due Date', tasks: [], color: '#adb5bd' }
    };

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

    tasks.forEach(task => {
      if (!task.due_on) {
        groups.noDueDate.tasks.push(task);
        return;
      }

      const dueDate = new Date(task.due_on);

      if (dueDate < today && !task.completed_at) {
        groups.overdue.tasks.push(task);
      } else if (dueDate.toDateString() === today.toDateString()) {
        groups.today.tasks.push(task);
      } else if (dueDate.toDateString() === tomorrow.toDateString()) {
        groups.tomorrow.tasks.push(task);
      } else if (dueDate <= endOfWeek) {
        groups.thisWeek.tasks.push(task);
      } else {
        groups.later.tasks.push(task);
      }
    });

    return Object.entries(groups)
      .filter(([, group]) => group.tasks.length > 0)
      .map(([key, group]) => ({ id: key, ...group }));
  }

  function groupTasksByProject(projects, sortBy) {
    let sortedProjects = [...projects];

    switch (sortBy) {
      case 'alphabetical':
        sortedProjects.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'date':
        sortedProjects.sort((a, b) => {
          const aLatestDue = Math.min(...a.tasks.filter(t => t.due_on).map(t => new Date(t.due_on)));
          const bLatestDue = Math.min(...b.tasks.filter(t => t.due_on).map(t => new Date(t.due_on)));
          return aLatestDue - bLatestDue;
        });
        break;
      case 'priority':
      default:
        sortedProjects.sort((a, b) => {
          const aAvgPriority = a.tasks.reduce((sum, task) => sum + calculatePriorityScore(task), 0) / a.tasks.length;
          const bAvgPriority = b.tasks.reduce((sum, task) => sum + calculatePriorityScore(task), 0) / b.tasks.length;
          return bAvgPriority - aAvgPriority;
        });
        break;
    }

    return sortedProjects.map(project => ({
      id: project.id,
      name: project.name,
      favorite: project.favorite,
      tasks: project.tasks.sort((a, b) => calculatePriorityScore(b) - calculatePriorityScore(a)),
      taskCount: project.tasks.length,
      overdueCount: project.tasks.filter(t => t.due_on && new Date(t.due_on) < new Date() && !t.completed_at).length
    }));
  }

  let opened = projects.filter((i) => i.favorite).map((i) => i.id.toString());

  if (opened.length === 0) {
    opened = projects[0]?.id.toString() || "";
  }

  const ViewControls = () => (
    <Grid justify="space-between" align="end" mb="lg">
      <Grid.Col span="content">
        <Group>
          {viewMode !== 'gantt' && (
            <>
              <Select
                value={groupBy}
                onChange={setGroupBy}
                data={[
                  { value: 'project', label: 'Group by Project' },
                  { value: 'labels', label: 'Group by Labels' },
                  { value: 'dates', label: 'Group by Due Date' }
                ]}
                size="sm"
                w={180}
              />

              {groupBy === 'project' && (
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  data={[
                    { value: 'priority', label: 'Sort by Priority' },
                    { value: 'alphabetical', label: 'Sort Alphabetically' },
                    { value: 'date', label: 'Sort by Due Date' }
                  ]}
                  size="sm"
                  w={160}
                />
              )}
            </>
          )}

          {viewMode === 'gantt' && (
            <>
              <SegmentedControl
                size="sm"
                value={ganttZoom}
                onChange={setGanttZoom}
                data={[
                  { label: 'Week', value: 'week' },
                  { label: 'Month', value: 'month' },
                  { label: 'Quarter', value: 'quarter' },
                ]}
              />
              <Switch
                size="sm"
                checked={ganttGroupByProject}
                onChange={(e) => setGanttGroupByProject(e.currentTarget.checked)}
                label="Group by project"
              />
            </>
          )}
        </Group>
      </Grid.Col>

      <Grid.Col span="content">
        <Group>
          <ActionIcon.Group>
            <ActionIcon
              size="lg"
              variant={viewMode === "list" ? "filled" : "default"}
              onClick={() => setViewMode("list")}
            >
              <Tooltip label="List view" openDelay={250} withArrow>
                <IconLayoutList style={{ width: "40%", height: "40%" }} />
              </Tooltip>
            </ActionIcon>
            <ActionIcon
              size="lg"
              variant={viewMode === "kanban" ? "filled" : "default"}
              onClick={() => setViewMode("kanban")}
            >
              <Tooltip label="Kanban view" openDelay={250} withArrow>
                <IconLayoutKanban style={{ width: "45%", height: "45%" }} />
              </Tooltip>
            </ActionIcon>
            <ActionIcon
              size="lg"
              variant={viewMode === "gantt" ? "filled" : "default"}
              onClick={() => setViewMode("gantt")}
            >
              <Tooltip label="Gantt view" openDelay={250} withArrow>
                <IconTable style={{ width: "45%", height: "45%" }} />
              </Tooltip>
            </ActionIcon>
          </ActionIcon.Group>
        </Group>
      </Grid.Col>
    </Grid>
  );

  const renderListView = () => {
    switch (groupBy) {
      case 'labels':
        return renderLabelGroups();
      case 'dates':
        return renderDateGroups();
      default:
        return renderProjectGroups();
    }
  };

  const renderProjectGroups = () => (
    <Accordion variant="separated" radius="md" multiple defaultValue={opened}>
      {groupedTasks.map((project) => (
        <Accordion.Item
          key={project.id}
          value={project.id.toString()}
          className={classes.accordionControl}
        >
          <Accordion.Control
            icon={
              project.favorite ? (
                <IconStarFilled
                  style={{
                    color: "var(--mantine-color-yellow-4)",
                    width: rem(20),
                    height: rem(20),
                  }}
                />
              ) : (
                <IconStar
                  style={{
                    width: rem(20),
                    height: rem(20),
                  }}
                />
              )
            }
          >
            <Group justify="space-between" w="100%">
              <Text fz={18} fw={600}>
                {project.name}
              </Text>
              <Group gap="xs">
                <Badge variant="light" size="sm" color="blue">
                  {project.taskCount} tasks
                </Badge>
                {project.overdueCount > 0 && (
                  <Badge variant="light" size="sm" color="red">
                    {project.overdueCount} overdue
                  </Badge>
                )}
              </Group>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap={6}>
              {project.tasks.map((task) => (
                <Task key={task.id} task={task} enhanced />
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );

  const renderLabelGroups = () => (
    <Stack gap="md">
      {groupedTasks.map((group) => (
        <Card key={group.id} shadow="sm" padding="md" radius="md" className={classes.labelGroup}>
          <Group justify="space-between" mb="sm">
            <Group gap="sm">
              <Badge
                variant="light"
                color={group.color}
                size="lg"
                leftSection={<IconTags size={14} />}
              >
                {group.name}
              </Badge>
              <Text size="sm" c="dimmed">
                {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
              </Text>
            </Group>
          </Group>
          <Stack gap={6}>
            {group.tasks.map((task) => (
              <Task key={`${group.id}-${task.id}`} task={task} enhanced showProject />
            ))}
          </Stack>
        </Card>
      ))}
    </Stack>
  );

  const renderDateGroups = () => (
    <Stack gap="md">
      {groupedTasks.map((group) => (
        <Card key={group.id} shadow="sm" padding="md" radius="md" className={classes.dateGroup}>
          <Group justify="space-between" mb="sm">
            <Group gap="sm">
              <Badge
                variant="light"
                color={group.color}
                size="lg"
                leftSection={<IconCalendar size={14} />}
              >
                {group.name}
              </Badge>
              <Text size="sm" c="dimmed">
                {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
              </Text>
            </Group>
          </Group>
          <Stack gap={6}>
            {group.tasks.map((task) => (
              <Task key={`${group.id}-${task.id}`} task={task} enhanced showProject />
            ))}
          </Stack>
        </Card>
      ))}
    </Stack>
  );

  const renderKanbanView = () => {
    const statusColumns = {
      todo: {
        name: 'To Do',
        tasks: allTasks.filter(task => !task.completed_at && (!task.due_on || new Date(task.due_on) >= new Date())),
        color: '#228be6'
      },
      inProgress: {
        name: 'In Progress',
        tasks: allTasks.filter(task => !task.completed_at && task.due_on && new Date(task.due_on) < new Date()),
        color: '#fd7e14'
      },
      completed: {
        name: 'Completed',
        tasks: allTasks.filter(task => task.completed_at),
        color: '#51cf66'
      }
    };

    const getPriorityLevel = (task) => {
      const isOverdue = task.due_on && new Date(task.due_on) < new Date() && !task.completed_at;
      const daysUntilDue = task.due_on ?
        Math.ceil((new Date(task.due_on) - new Date()) / (1000 * 60 * 60 * 24)) : null;

      if (isOverdue) return 'critical';
      if (daysUntilDue !== null && daysUntilDue <= 1 && daysUntilDue >= 0) return 'high';
      if (daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue >= 0) return 'medium';
      return 'normal';
    };

    return (
      <div className={classes.kanbanViewport}>
        {Object.entries(statusColumns).map(([key, column]) => (
          <div key={key} className={classes.kanbanColumn}>
            <div className={classes.columnHeader}>
              <Group justify="space-between" mb="md">
                <Group gap="sm">
                  <Text fz={18} fw={700} c={column.color}>
                    {column.name}
                  </Text>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: column.color,
                    boxShadow: `0 0 8px ${column.color}40`
                  }} />
                </Group>
                <Badge
                  variant="light"
                  color={column.color}
                  size="lg"
                  style={{
                    background: `${column.color}15`,
                    color: column.color,
                    fontWeight: 600
                  }}
                >
                  {column.tasks.length}
                </Badge>
              </Group>
            </div>

            <div className={classes.columnTasks}>
              {column.tasks.map((task, index) => {
                const isOverdue = task.due_on && new Date(task.due_on) < new Date() && !task.completed_at;
                const priority = getPriorityLevel(task);

                return (
                  <Card
                    key={task.id}
                    shadow="sm"
                    padding="md"
                    radius="md"
                    className={classes.kanbanTask}
                    data-priority={priority}
                    onClick={() => redirectTo("projects.tasks.open", [task.project_id, task.id])}
                    style={{
                      animationDelay: `${0.5 + (index * 0.1)}s`
                    }}
                  >
                    <Stack gap="sm">
                      {/* Task header with priority and favorite */}
                      <Group justify="space-between" align="flex-start">
                        <Group gap="xs" style={{ flex: 1 }}>
                          {priority !== 'normal' && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: priority === 'critical' ? '#fa5252' :
                                             priority === 'high' ? '#fd7e14' : '#fab005',
                              flexShrink: 0,
                              marginTop: '2px',
                              boxShadow: `0 0 4px ${priority === 'critical' ? '#fa5252' :
                                                   priority === 'high' ? '#fd7e14' : '#fab005'}60`
                            }} />
                          )}
                          <Text size="sm" fw={600} lineClamp={2} style={{ flex: 1 }}>
                            #{task.number}: {task.name}
                          </Text>
                        </Group>
                        {task.project_favorite && (
                          <IconStar
                            size={16}
                            color="var(--mantine-color-yellow-6)"
                            style={{
                              flexShrink: 0,
                              filter: 'drop-shadow(0 0 2px rgba(255, 193, 7, 0.5))'
                            }}
                          />
                        )}
                      </Group>

                      {/* Project and task group info */}
                      <Group gap="xs">
                        <Badge variant="dot" size="xs" color="gray">
                          {task.project_name}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {task.task_group.name}
                        </Text>
                      </Group>

                      {/* Assignee with enhanced styling */}
                      {task.assigned_to_user && (
                        <Group gap="xs" style={{
                          padding: '4px 8px',
                          backgroundColor: 'light-dark(var(--mantine-color-blue-0), var(--mantine-color-dark-8))',
                          borderRadius: 'var(--mantine-radius-sm)',
                          border: '1px solid light-dark(var(--mantine-color-blue-2), var(--mantine-color-dark-6))'
                        }}>
                          <Avatar size={20} color="blue" radius="xl">
                            {task.assigned_to_user.name.charAt(0)}
                          </Avatar>
                          <Text size="xs" fw={500} c="blue">
                            {task.assigned_to_user.name}
                          </Text>
                        </Group>
                      )}

                      {/* Due date with enhanced styling */}
                      {task.due_on && (
                        <Group gap="xs" style={{
                          padding: '4px 8px',
                          backgroundColor: isOverdue ?
                            'light-dark(var(--mantine-color-red-0), var(--mantine-color-red-9))' :
                            'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
                          borderRadius: 'var(--mantine-radius-sm)',
                          border: `1px solid ${isOverdue ?
                            'light-dark(var(--mantine-color-red-3), var(--mantine-color-red-7))' :
                            'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-6))'}`
                        }}>
                          <IconCalendarDue size={12} color={isOverdue ? 'var(--mantine-color-red-6)' : undefined} />
                          <Text
                            size="xs"
                            fw={isOverdue ? 600 : 400}
                            c={isOverdue ? "red" : "dimmed"}
                          >
                            {new Date(task.due_on).toLocaleDateString()}
                          </Text>
                        </Group>
                      )}

                      {/* Time estimation */}
                      {task.estimation && (
                        <Group gap="xs" style={{
                          padding: '4px 8px',
                          backgroundColor: 'light-dark(var(--mantine-color-teal-0), var(--mantine-color-dark-8))',
                          borderRadius: 'var(--mantine-radius-sm)',
                          border: '1px solid light-dark(var(--mantine-color-teal-2), var(--mantine-color-dark-6))'
                        }}>
                          <IconClock size={12} color="var(--mantine-color-teal-6)" />
                          <Text size="xs" fw={500} c="teal">
                            {task.estimation}h estimated
                          </Text>
                        </Group>
                      )}

                      {/* Labels with improved styling */}
                      {task.labels.length > 0 && (
                        <Group gap={6} style={{ marginTop: '4px' }}>
                          {task.labels.slice(0, 3).map((label) => (
                            <Badge
                              key={label.id}
                              size="xs"
                              variant="light"
                              color={label.color}
                              style={{
                                textTransform: 'none',
                                fontWeight: 500,
                                border: `1px solid ${label.color}40`
                              }}
                            >
                              {label.name}
                            </Badge>
                          ))}
                          {task.labels.length > 3 && (
                            <Badge size="xs" variant="outline" color="gray">
                              +{task.labels.length - 3}
                            </Badge>
                          )}
                        </Group>
                      )}
                    </Stack>
                  </Card>
                );
              })}

              {column.tasks.length === 0 && (
                <Center p="xl" className={classes.emptyColumn}>
                  <Stack align="center" gap="sm">
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: `${column.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px dashed ${column.color}60`
                    }}>
                      <IconGridDots size={24} color={`${column.color}80`} />
                    </div>
                    <Text size="sm" c="dimmed" ta="center" fw={500}>
                      No tasks yet
                    </Text>
                    <Text size="xs" c="dimmed" ta="center">
                      Tasks will appear here
                    </Text>
                  </Stack>
                </Center>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderGanttView = () => (
    <GanttChart
      tasks={allTasks}
      zoom={ganttZoom}
      groupByProject={ganttGroupByProject}
      onBarClick={(task) => redirectTo("projects.tasks.open", [task.project_id, task.id])}
    />
  );

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <div>My Work</div>
        <div>Tasks</div>
      </Breadcrumbs>

      <Title order={1} mb={20}>
        Tasks assigned to you
      </Title>

      <Box className={`${viewMode}-view`}>
        {projects.length ? (
          <>
            <ViewControls />

            {viewMode === 'list' ? renderListView() : viewMode === 'kanban' ? renderKanbanView() : renderGanttView()}
          </>
        ) : (
          <Center mih={300}>
            <EmptyWithIcon
              title="All caught up!"
              subtitle="No tasks assigned at the moment"
              icon={IconRocket}
            />
          </Center>
        )}
      </Box>
    </>
  );
};

TasksIndex.layout = (page) => <Layout title="My Tasks">{page}</Layout>;

export default TasksIndex;
