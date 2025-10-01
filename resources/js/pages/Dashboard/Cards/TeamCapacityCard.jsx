import { Card, Group, Progress, SimpleGrid, Stack, Text, ThemeIcon, Tooltip, rem } from '@mantine/core';
import { IconUsers, IconClock, IconAlertTriangle, IconTrendingUp } from '@tabler/icons-react';
import { redirectTo } from '@/utils/route';

export default function TeamCapacityCard({ capacityData }) {
  if (!capacityData || !capacityData.summary) {
    return null;
  }

  const { summary, overCapacityMembers, availableMembers } = capacityData;

  const getUtilColor = (util) => {
    if (util >= 100) return 'red';
    if (util >= 90) return 'orange';
    if (util >= 75) return 'yellow';
    return 'green';
  };

  return (
    <Card withBorder padding="lg" radius="md" style={{ cursor: 'pointer' }} onClick={() => redirectTo('reports.team-capacity')}>
      <Group justify="space-between" mb="md">
        <Stack gap={4}>
          <Text fw={600} size="lg">Team Capacity</Text>
          <Text size="sm" c="dimmed">Current week overview</Text>
        </Stack>
        <ThemeIcon size="xl" radius="xl" color="blue" variant="light">
          <IconUsers style={{ width: rem(20), height: rem(20) }} />
        </ThemeIcon>
      </Group>

      <SimpleGrid cols={2} spacing="md" mb="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Avg Planned Utilization</Text>
          <Group gap="xs">
            <Text size="lg" fw={700} c={getUtilColor(summary.avg_planned_util)}>
              {summary.avg_planned_util?.toFixed(0)}%
            </Text>
            <Progress
              value={Math.min(100, summary.avg_planned_util ?? 0)}
              color={getUtilColor(summary.avg_planned_util ?? 0)}
              size="sm"
              style={{ flex: 1 }}
              radius="xl"
            />
          </Group>
        </Stack>

        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Available Hours</Text>
          <Group gap="xs">
            <IconClock size={16} />
            <Text size="lg" fw={700}>{summary.total_available?.toFixed(0)}h</Text>
          </Group>
        </Stack>
      </SimpleGrid>

      <SimpleGrid cols={3} spacing="md" mb="md">
        <Tooltip label="Members working at or over capacity">
          <Stack gap={2} ta="center">
            <Text size="xs" c="dimmed">At/Over Capacity</Text>
            <Group gap="xs" justify="center">
              <IconAlertTriangle size={16} color="orange" />
              <Text fw={600} c="orange">{summary.at_capacity + summary.over_capacity}</Text>
            </Group>
          </Stack>
        </Tooltip>

        <Tooltip label="Members available for new work">
          <Stack gap={2} ta="center">
            <Text size="xs" c="dimmed">Available</Text>
            <Group gap="xs" justify="center">
              <IconClock size={16} color="green" />
              <Text fw={600} c="green">{summary.available}</Text>
            </Group>
          </Stack>
        </Tooltip>

        <Tooltip label="Average team performance">
          <Stack gap={2} ta="center">
            <Text size="xs" c="dimmed">Avg Completion</Text>
            <Group gap="xs" justify="center">
              <IconTrendingUp size={16} color="blue" />
              <Text fw={600} c="blue">{summary.avg_completion?.toFixed(0)}%</Text>
            </Group>
          </Stack>
        </Tooltip>
      </SimpleGrid>

      {overCapacityMembers.length > 0 && (
        <Group gap="xs" mb="sm">
          <Text size="sm" c="red" fw={500}>Over capacity:</Text>
          {overCapacityMembers.slice(0, 3).map(member => (
            <Tooltip key={member.id} label={`${member.name}: ${member.planned_utilization}%`}>
              <Text size="sm" c="red">{member.name}</Text>
            </Tooltip>
          ))}
          {overCapacityMembers.length > 3 && (
            <Text size="sm" c="dimmed">+{overCapacityMembers.length - 3} more</Text>
          )}
        </Group>
      )}

      <Text size="xs" c="dimmed" ta="center" mt="sm">
        Click to view detailed capacity planning →
      </Text>
    </Card>
  );
}
