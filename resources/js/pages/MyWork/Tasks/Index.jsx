import EmptyWithIcon from "@/components/EmptyWithIcon";
import Layout from "@/layouts/MainLayout";
import { usePage } from "@inertiajs/react";
import {
  Accordion,
  Box,
  Breadcrumbs,
  Center,
  Stack,
  Text,
  Title,
  rem,
  Tabs,
  Group,
  Badge,
  Select,
  Divider,
  Card,
  ActionIcon,
  Tooltip
} from "@mantine/core";
import {
  IconRocket,
  IconStar,
  IconStarFilled,
  IconTags,
  IconCalendar,
  IconFolder,
  IconListCheck,
  IconGridDots
} from "@tabler/icons-react";
import { useState, useMemo } from "react";
import Task from "./Task";
import classes from "./css/Index.module.css";

const TasksIndex = () => {
  let { projects } = usePage().props;

  const [viewMode, setViewMode] = useState('grouped'); // 'grouped', 'labels', 'dates'
  const [sortBy, setSortBy] = useState('priority'); // 'priority', 'date', 'project', 'alphabetical'

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
    switch (viewMode) {
      case 'labels':
        return groupTasksByLabels(allTasks);
      case 'dates':
        return groupTasksByDates(allTasks);
      default:
        return groupTasksByProject(projects, sortBy);
    }
  }, [allTasks, projects, viewMode, sortBy]);

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
    <Group justify="space-between" mb="md">
      <Tabs value={viewMode} onChange={setViewMode}>
        <Tabs.List>
          <Tabs.Tab value="grouped" leftSection={<IconFolder size={16} />}>
            By Project
          </Tabs.Tab>
          <Tabs.Tab value="labels" leftSection={<IconTags size={16} />}>
            By Labels
          </Tabs.Tab>
          <Tabs.Tab value="dates" leftSection={<IconCalendar size={16} />}>
            By Due Date
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {viewMode === 'grouped' && (
        <Select
          value={sortBy}
          onChange={setSortBy}
          data={[
            { value: 'priority', label: 'Priority' },
            { value: 'alphabetical', label: 'Alphabetical' },
            { value: 'date', label: 'Due Date' }
          ]}
          size="sm"
          w={140}
        />
      )}
    </Group>
  );

  const renderGroupedView = () => (
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

  const renderLabelView = () => (
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

  const renderDateView = () => (
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

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <div>My Work</div>
        <div>Tasks</div>
      </Breadcrumbs>

      <Title order={1} mb={20}>
        Tasks assigned to you
      </Title>

      <Box maw={1200}>
        {projects.length ? (
          <>
            <ViewControls />

            {viewMode === 'grouped' && renderGroupedView()}
            {viewMode === 'labels' && renderLabelView()}
            {viewMode === 'dates' && renderDateView()}
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
