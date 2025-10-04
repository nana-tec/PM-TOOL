import { Label } from "@/components/Label";
import useTaskDrawerStore from "@/hooks/store/useTaskDrawerStore";
import { isOverdue } from "@/utils/task";
import { getInitials } from "@/utils/user";
import { Draggable } from "@hello-pangea/dnd";
import { Link } from "@inertiajs/react";
import { Avatar, Badge, Group, Text, Tooltip, rem, useComputedColorScheme } from "@mantine/core";
import TaskActions from "../TaskActions";
import classes from "./css/TaskCard.module.css";

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

export default function TaskCard({ task, index }) {
  const { openEditTask } = useTaskDrawerStore();
  const computedColorScheme = useComputedColorScheme();

  return (
    <Draggable draggableId={"task-" + task.id} index={index}>
      {(provided, snapshot) => (
        <div
          {...provided.draggableProps}
          ref={provided.innerRef}
          className={`${classes.task} ${snapshot.isDragging && classes.itemDragging} ${
            task.completed_at !== null && classes.completed
          }`}
        >
          <div {...(can("reorder task") && provided.dragHandleProps)}>
            <Text
              className={classes.name}
              size="xs"
              fw={500}
              c={isOverdue(task) && task.completed_at === null ? "red.7" : ""}
              onClick={() => openEditTask(task)}
            >
              #{task.number + ": " + task.name}
            </Text>

            <Group wrap="nowrap" justify="space-between">
              <Group wrap="wrap" style={{ rowGap: rem(3), columnGap: rem(8) }} mt={5}>
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
                {task.labels.map((label) => (
                  <Label
                    key={label.id}
                    name={label.name}
                    color={label.color}
                    size={9}
                    dot={false}
                  />
                ))}
              </Group>

              {task.assigned_to_user && (
                <Tooltip label={task.assigned_to_user.name} openDelay={1000} withArrow>
                  <Link
                    href={route("users.edit", task.assigned_to_user.id)}
                    style={{ textDecoration: "none" }}
                  >
                    <Avatar
                      src={task.assigned_to_user.avatar}
                      radius="xl"
                      size={20}
                      color={computedColorScheme === "light" ? "white" : "blue"}
                    >
                      {getInitials(task.assigned_to_user.name)}
                    </Avatar>
                  </Link>
                </Tooltip>
              )}

              {(can("archive task") || can("restore task")) && (
                <TaskActions task={task} className={classes.actions} />
              )}
            </Group>
          </div>
        </div>
      )}
    </Draggable>
  );
}
