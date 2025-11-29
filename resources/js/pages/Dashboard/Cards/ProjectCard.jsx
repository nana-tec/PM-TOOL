import Card from "@/components/Card";
import { redirectTo, reloadWithQuery } from "@/utils/route";
import { Badge, Group, RingProgress, Stack, Text, Title, Tooltip, rem } from "@mantine/core";
import { IconStarFilled } from "@tabler/icons-react";
import round from "lodash/round";
import classes from "./css/ProjectCard.module.css";
import { usePage } from "@inertiajs/react";

export function ProjectCard({ project }) {
  const { metricMode } = usePage().props;
  const counts = metricMode === 'parent'
    ? {
        all: project.parent_only_all_tasks_count,
        completed: project.parent_only_completed_tasks_count,
        overdue: project.parent_only_overdue_tasks_count,
      }
    : {
        all: project.all_tasks_count,
        completed: project.completed_tasks_count,
        overdue: project.overdue_tasks_count,
      };

  let completedPercent = 0;
  let overduePercent = 0;

  if (counts.all > 0) {
    completedPercent = (counts.completed / counts.all) * 100;
    overduePercent = (counts.overdue / counts.all) * 100;
  }

  const toggleMode = () => reloadWithQuery({ metrics: metricMode === 'parent' ? 'aggregated' : 'parent' }, true);

  return (
    <Card bg="none">
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={6}>
          <Group justify="space-between">
            <Title
              fz={24}
              onClick={() => redirectTo("projects.tasks", project.id)}
              className={classes.link}
            >
              {project.favorite && (
                <IconStarFilled
                  style={{
                    color: "var(--mantine-color-yellow-4)",
                    width: rem(15),
                    height: rem(15),
                    marginRight: 10,
                  }}
                />
              )}
              {project.name}
            </Title>
            <Badge size="xs" variant="light" onClick={toggleMode} style={{ cursor: 'pointer' }}>
              {metricMode === 'parent' ? 'Parent-only' : 'Subtree'}
            </Badge>
          </Group>
          <Text fz="xs" fw={700} c="dimmed" mb={4}>
            {project.client_company.name}
          </Text>
          <div>
            <Tooltip label="Completed tasks" openDelay={500} withArrow>
              <Text fz="lg" fw={500} inline span>
                Tasks: {counts.completed} / {counts.all}
              </Text>
            </Tooltip>
          </div>
        </Stack>
        <RingProgress
          size={100}
          thickness={10}
          sections={[
            { value: 100 - (completedPercent + overduePercent), color: "gray" },
            {
              value: overduePercent,
              color: "red",
              tooltip: `Overdue: ${counts.overdue}`,
            },
            {
              value: completedPercent,
              color: "blue",
              tooltip: `Completed: ${counts.completed}`,
            },
          ]}
          label={
            <Text fz={15} fw={700} ta="center">
              {round(completedPercent)}%
            </Text>
          }
        />
      </Group>
    </Card>
  );
}
