import { redirectTo } from "@/utils/route";
import { Card, Group, RingProgress, Stack, Text, Badge, Progress, rem } from "@mantine/core";
import { IconStarFilled } from "@tabler/icons-react";
import round from "lodash/round";
import { usePage } from "@inertiajs/react";

export function ProjectCard({ project, compact = false }) {
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

  if (compact) {
    return (
      <Card
        withBorder
        radius="md"
        p="sm"
        style={{ cursor: 'pointer' }}
        onClick={() => redirectTo("projects.tasks", project.id)}
      >
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap={4} wrap="nowrap">
              {project.favorite && (
                <IconStarFilled style={{ color: "var(--mantine-color-yellow-4)", width: rem(12), height: rem(12) }} />
              )}
              <Text size="sm" fw={600} lineClamp={1}>{project.name}</Text>
            </Group>
            <Text size="xs" c="dimmed">{project.client_company?.name}</Text>
          </Stack>
          <Badge size="sm" variant="light" color={completedPercent >= 80 ? 'green' : completedPercent >= 40 ? 'blue' : 'gray'}>
            {round(completedPercent)}%
          </Badge>
        </Group>
        <Progress.Root mt={6} size="xs" radius="xl">
          <Progress.Section value={completedPercent} color="blue" />
          <Progress.Section value={overduePercent} color="red" />
        </Progress.Root>
      </Card>
    );
  }

  return (
    <Card
      withBorder
      radius="md"
      p="lg"
      style={{ cursor: 'pointer' }}
      onClick={() => redirectTo("projects.tasks", project.id)}
    >
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            {project.favorite && (
              <IconStarFilled style={{ color: "var(--mantine-color-yellow-4)", width: rem(15), height: rem(15) }} />
            )}
            <Text fz={20} fw={700} lineClamp={1}>{project.name}</Text>
          </Group>
          <Text fz="xs" fw={500} c="dimmed">{project.client_company?.name}</Text>

          <Group gap="lg" mt={6}>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Completed</Text>
              <Text fw={700} c="green">{counts.completed}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pending</Text>
              <Text fw={700} c="orange">{Math.max(0, counts.all - counts.completed)}</Text>
            </Stack>
            {counts.overdue > 0 && (
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Overdue</Text>
                <Text fw={700} c="red">{counts.overdue}</Text>
              </Stack>
            )}
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text>
              <Text fw={700}>{counts.all}</Text>
            </Stack>
          </Group>
        </Stack>
        <RingProgress
          size={90}
          thickness={8}
          sections={[
            { value: 100 - (completedPercent + overduePercent), color: "gray" },
            { value: overduePercent, color: "red", tooltip: `Overdue: ${counts.overdue}` },
            { value: completedPercent, color: "blue", tooltip: `Completed: ${counts.completed}` },
          ]}
          label={
            <Text fz={14} fw={700} ta="center">
              {round(completedPercent)}%
            </Text>
          }
        />
      </Group>
    </Card>
  );
}
