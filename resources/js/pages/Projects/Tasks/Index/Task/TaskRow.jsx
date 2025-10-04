import { Label } from "@/components/Label";
import useTaskDrawerStore from "@/hooks/store/useTaskDrawerStore";
import useTasksStore from "@/hooks/store/useTasksStore";
import { isOverdue } from "@/utils/task";
import { shortName } from "@/utils/user";
import { Draggable } from "@hello-pangea/dnd";
import { Link } from "@inertiajs/react";
import { Badge, Checkbox, Flex, Group, Pill, Text, Tooltip, rem } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import TaskActions from "../TaskActions";
import classes from "./css/TaskRow.module.css";

function priorityColor(p) {
  switch (p) {
    case 'low': return 'gray';
    case 'medium': return 'blue';
    case 'high': return 'orange';
    case 'critical': return 'red';
    default: return 'gray';
  }
}

function complexityColor(c) {
  switch (c) {
    case 'trivial': return 'gray';
    case 'easy': return 'green';
    case 'medium': return 'blue';
    case 'hard': return 'grape';
    case 'extreme': return 'dark';
    default: return 'gray';
  }
}

export default function TaskRow({ task, index }) {
  const { complete } = useTasksStore();
  const { openEditTask } = useTaskDrawerStore();

  return (
    <Draggable draggableId={"task-" + task.id} index={index}>
      {(provided, snapshot) => (
        <Flex
          {...provided.draggableProps}
          ref={provided.innerRef}
          className={`${classes.task} ${snapshot.isDragging && classes.itemDragging} ${
            task.completed_at !== null && classes.completed
          }`}
          wrap="nowrap"
        >
          <Group gap="sm" wrap="nowrap" w="100%">
            <div {...provided.dragHandleProps}>
              <IconGripVertical
                style={{
                  width: rem(18),
                  height: rem(18),
                  display: can("reorder task") ? "inline" : "none",
                }}
                stroke={1.5}
                className={classes.dragHandle}
              />
            </div>

            <Checkbox
              size="sm"
              radius="xl"
              color="green"
              checked={task.completed_at !== null}
              onChange={(e) => complete(task, e.currentTarget.checked)}
              className={can("complete task") ? classes.checkbox : classes.disabledCheckbox}
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
              className={classes.name}
              size="sm"
              fw={500}
              truncate="end"
              c={isOverdue(task) && task.completed_at === null ? "red.7" : ""}
              onClick={() => openEditTask(task)}
            >
              #{task.number + ": " + task.name}
            </Text>

            {task.priority && (
              <Badge size="xs" variant="light" color={priorityColor(task.priority)} radius="sm">
                {String(task.priority).charAt(0).toUpperCase() + String(task.priority).slice(1)}
              </Badge>
            )}
            {task.complexity && (
              <Badge size="xs" variant="light" color={complexityColor(task.complexity)} radius="sm">
                {String(task.complexity).charAt(0).toUpperCase() + String(task.complexity).slice(1)}
              </Badge>
            )}

            <Group wrap="nowrap" style={{ rowGap: rem(3), columnGap: rem(12) }}>
              {task.labels.map((label) => (
                <Label key={label.id} name={label.name} color={label.color} />
              ))}
            </Group>

            {(can("archive task") || can("restore task")) && (
              <TaskActions task={task} className={classes.actions} />
            )}
          </Group>
        </Flex>
      )}
    </Draggable>
  );
}
