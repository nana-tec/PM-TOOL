import { Label } from "@/components/Label";
import { isOverdue } from "@/utils/task";
import { shortName } from "@/utils/user";
import { Link } from "@inertiajs/react";
import { Checkbox, Flex, Group, Pill, Text, Tooltip } from "@mantine/core";
import classes from "../Task/css/TaskRow.module.css";
import TaskActions from "../TaskActions";

export default function ArchivedTask({ task }) {
  const priorityColor = {
    urgent: 'red',
    high: 'orange',
    medium: 'blue',
    low: 'gray',
  };

  const complexityColor = {
    xs: 'teal',
    s: 'cyan',
    m: 'gray',
    l: 'violet',
    xl: 'grape',
  };

  return (
    <Flex className={`${classes.task} ${task.completed_at !== null && classes.completed}`}>
      <Group gap="sm">
        <Checkbox
          size="sm"
          radius="xl"
          color="green"
          defaultChecked={task.completed_at !== null}
          className={classes.disabledCheckbox}
        />
        {task.assigned_to_user && (
          <Link href={route("users.edit", task.assigned_to_user.id)}>
            <Tooltip label={task.assigned_to_user.name} openDelay={1000} withArrow>
              <Pill size="sm" className={classes.user}>
                {shortName(task.assigned_to_user.name)}
              </Pill>
            </Tooltip>
          </Link>
        )}
        <Text
          key={task.id}
          className={classes.name}
          style={{ cursor: "default" }}
          size="sm"
          fw={500}
          c={isOverdue(task) && task.completed_at === null ? "red" : ""}
        >
          #{task.number + ": " + task.name}
        </Text>

        <Group gap={12} ml={8}>
          {task.labels.map((label) => (
            <Label key={label.id} name={label.name} color={label.color} />
          ))}
          {task.priority && (
            <Pill size='sm' color={priorityColor[task.priority] || 'gray'}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Pill>
          )}
          {task.complexity && (
            <Pill size='sm' color={complexityColor[task.complexity] || 'gray'}>
              {task.complexity.toUpperCase()}
            </Pill>
          )}
        </Group>

        <TaskActions task={task} />
      </Group>
    </Flex>
  );
}
