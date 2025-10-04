import { Label } from "@/components/Label";
import useTaskDrawerStore from "@/hooks/store/useTaskDrawerStore";
import { isOverdue } from "@/utils/task";
import { getInitials } from "@/utils/user";
import { Draggable } from "@hello-pangea/dnd";
import { Link } from "@inertiajs/react";
import { Avatar, Group, Text, Tooltip, Pill, rem, useComputedColorScheme } from "@mantine/core";
import TaskActions from "../TaskActions";
import classes from "./css/TaskCard.module.css";

export default function TaskCard({ task, index }) {
  const { openEditTask } = useTaskDrawerStore();
  const computedColorScheme = useComputedColorScheme();

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
              <Group wrap="wrap" style={{ rowGap: rem(3), columnGap: rem(12) }} mt={5}>
                {task.labels.map((label) => (
                  <Label
                    key={label.id}
                    name={label.name}
                    color={label.color}
                    size={9}
                    dot={false}
                  />
                ))}
                {task.priority && (
                  <Pill size="sm" color={priorityColor[task.priority] || 'gray'}>
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                  </Pill>
                )}
                {task.complexity && (
                  <Pill size="sm" color={complexityColor[task.complexity] || 'gray'}>
                    {task.complexity.toUpperCase()}
                  </Pill>
                )}
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
