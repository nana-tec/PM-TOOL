import { Card, Group, SimpleGrid, Stack, Text, ThemeIcon, rem, Progress, Tooltip } from '@mantine/core';
import {
  IconChecks,
  IconClock,
  IconAlertTriangle,
  IconFolder,
  IconUsers,
  IconTrendingUp,
} from '@tabler/icons-react';

export default function DashboardStats({ projects, overdueTasks, recentlyAssignedTasks }) {
  const totalTasks = projects.reduce((s, p) => s + (p.all_tasks_count || 0), 0);
  const completedTasks = projects.reduce((s, p) => s + (p.completed_tasks_count || 0), 0);
  const pendingTasks = totalTasks - completedTasks;
  const overdueCount = overdueTasks?.length || 0;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const stats = [
    {
      label: 'Active Projects',
      value: projects.length,
      icon: IconFolder,
      color: 'blue',
    },
    {
      label: 'Tasks Completed',
      value: completedTasks,
      icon: IconChecks,
      color: 'green',
    },
    {
      label: 'Tasks Pending',
      value: pendingTasks,
      icon: IconClock,
      color: 'orange',
    },
    {
      label: 'Overdue Tasks',
      value: overdueCount,
      icon: IconAlertTriangle,
      color: 'red',
    },
    {
      label: 'Overall Progress',
      value: `${progressPct}%`,
      icon: IconTrendingUp,
      color: 'teal',
      progress: progressPct,
    },
  ];

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
      {stats.map((stat) => (
        <Card key={stat.label} withBorder p="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{stat.label}</Text>
              <Text fw={700} size="xl" c={stat.color}>{stat.value}</Text>
            </Stack>
            <ThemeIcon size="lg" radius="md" color={stat.color} variant="light">
              <stat.icon style={{ width: rem(18), height: rem(18) }} />
            </ThemeIcon>
          </Group>
          {stat.progress !== undefined && (
            <Tooltip label={`${stat.progress}% complete`}>
              <Progress value={stat.progress} color={stat.color} size="sm" radius="xl" mt="sm" />
            </Tooltip>
          )}
        </Card>
      ))}
    </SimpleGrid>
  );
}

