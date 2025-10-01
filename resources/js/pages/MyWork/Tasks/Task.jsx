import { Label } from "@/components/Label";
import TaskGroupLabel from "@/components/TaskGroupLabel";
import { diffForHumans } from "@/utils/datetime";
import { redirectTo } from "@/utils/route";
import { isOverdue } from "@/utils/task";
import { shortName } from "@/utils/user";
import { Link } from "@inertiajs/react";
import {
  Flex,
  Group,
  Pill,
  Text,
  Tooltip,
  rem,
  Badge,
  ActionIcon,
  Box,
  Paper,
  Stack,
  Progress
} from "@mantine/core";
import {
  IconClock,
  IconCalendarDue,
  IconAlertTriangle,
  IconCheckbox,
  IconFolderOpen,
  IconEstimate
} from "@tabler/icons-react";
import classes from "./css/Task.module.css";

export default function Task({ task, enhanced = false, showProject = false }) {
  const isTaskOverdue = isOverdue(task);
  const isCompleted = task.completed_at !== null;

  // Calculate days until due
  const daysUntilDue = task.due_on ?
    Math.ceil((new Date(task.due_on) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  // Get priority level based on various factors
  const getPriorityLevel = () => {
    if (isTaskOverdue && !isCompleted) return 'critical';
    if (daysUntilDue !== null && daysUntilDue <= 1 && daysUntilDue >= 0) return 'high';
    if (daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue >= 0) return 'medium';
    return 'normal';
  };

  const priorityLevel = getPriorityLevel();
  const priorityColors = {
    critical: 'red',
    high: 'orange',
    medium: 'yellow',
    normal: 'gray'
  };

  const formatDueDate = () => {
    if (!task.due_on) return null;

    if (isTaskOverdue && !isCompleted) {
      return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''} overdue`;
    }

    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    if (daysUntilDue > 0 && daysUntilDue <= 7) return `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`;

    return diffForHumans(task.due_on, true);
  };

  const TaskContent = () => (
    <>
      {/* Priority indicator */}
      {enhanced && priorityLevel !== 'normal' && (
        <div className={classes.priorityIndicator} data-priority={priorityLevel} />
      )}

      {/* Main content */}
      <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
        {/* Task Group */}
        <Tooltip label="Task group" openDelay={1000} withArrow>
          <TaskGroupLabel size="sm">{task.task_group.name}</TaskGroupLabel>
        </Tooltip>

        {/* Assigned User */}
        {task.assigned_to_user && (
          <Link href={route("users.edit", task.assigned_to_user.id)}>
            <Tooltip label={task.assigned_to_user.name} openDelay={1000} withArrow>
              <Pill size="sm" className={classes.user}>
                {shortName(task.assigned_to_user.name)}
              </Pill>
            </Tooltip>
          </Link>
        )}

        {/* Project name (when showing in label/date views) */}
        {enhanced && showProject && (
          <Tooltip label="Project" openDelay={1000} withArrow>
            <Badge
              variant="light"
              color="gray"
              size="sm"
              leftSection={<IconFolderOpen size={12} />}
              className={classes.projectBadge}
            >
              {task.project_name}
            </Badge>
          </Tooltip>
        )}

        {/* Task name with priority styling */}
        <Tooltip
          disabled={!isTaskOverdue}
          label={`${diffForHumans(task.due_on, true)} overdue`}
          openDelay={1000}
          withArrow
        >
          <Text
            className={`${classes.name} ${enhanced ? classes.enhancedName : ''}`}
            size="sm"
            fw={enhanced ? 500 : 500}
            truncate="end"
            c={isTaskOverdue && !isCompleted ? "red" : ""}
            onClick={() => redirectTo("projects.tasks.open", [task.project_id, task.id])}
          >
            #{task.number}: {task.name}
          </Text>
        </Tooltip>

        {/* Labels */}
        <Group wrap="wrap" style={{ rowGap: rem(3), columnGap: rem(8) }}>
          {task.labels.map((label) => (
            <Label key={label.id} name={label.name} color={label.color} />
          ))}
        </Group>
      </Group>

      {/* Enhanced metadata */}
      {enhanced && (
        <Group gap="xs" className={classes.metadata}>
          {/* Due date */}
          {task.due_on && (
            <Tooltip
              label={`Due: ${new Date(task.due_on).toLocaleDateString()}`}
              openDelay={1000}
              withArrow
            >
              <Badge
                variant="light"
                color={isTaskOverdue && !isCompleted ? 'red' : daysUntilDue <= 3 ? 'orange' : 'blue'}
                size="sm"
                leftSection={<IconCalendarDue size={12} />}
                className={classes.dueBadge}
              >
                {formatDueDate()}
              </Badge>
            </Tooltip>
          )}

          {/* Estimation */}
          {task.estimation && (
            <Tooltip label={`Estimated: ${task.estimation}h`} openDelay={1000} withArrow>
              <Badge
                variant="light"
                color="teal"
                size="sm"
                leftSection={<IconClock size={12} />}
              >
                {task.estimation}h
              </Badge>
            </Tooltip>
          )}

          {/* Completion status */}
          {isCompleted && (
            <Badge
              variant="light"
              color="green"
              size="sm"
              leftSection={<IconCheckbox size={12} />}
            >
              Completed
            </Badge>
          )}
        </Group>
      )}
    </>
  );

  if (enhanced) {
    return (
      <Paper
        className={`${classes.enhancedTask} ${isCompleted ? classes.completed : ''}`}
        p="sm"
        radius="md"
        withBorder
      >
        <Flex
          direction="row"
          align="center"
          justify="space-between"
          wrap="nowrap"
          gap="md"
        >
          <TaskContent />
        </Flex>
      </Paper>
    );
  }

  return (
    <Flex
      className={`${classes.task} ${isCompleted ? classes.completed : ''}`}
      wrap="nowrap"
    >
      <TaskContent />
    </Flex>
  );
}
