import { Card, Group, Stack, Text, Title, Anchor, SimpleGrid, ThemeIcon, rem } from '@mantine/core';
import { IconExternalLink, IconUsers, IconFolder, IconChartBar } from '@tabler/icons-react';

export default function TeamInsightsCard() {
  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="center" mb="xs">
        <Title order={5}>Team insights</Title>
      </Group>
      <Stack gap="md">
        <Text size="sm" c="dimmed">View detailed reports about your team and projects.</Text>

        <SimpleGrid cols={1} spacing="xs">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size="sm" radius="xl" color="blue" variant="light"><IconUsers style={{ width: rem(14), height: rem(14) }} /></ThemeIcon>
              <Text size="sm" fw={500}>Member report</Text>
            </Group>
            <Anchor href={route('reports.member-report')} onClick={(e) => { e.preventDefault(); window.location.href = route('reports.member-report'); }} size="xs">
              Open <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
            </Anchor>
          </Group>

          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size="sm" radius="xl" color="green" variant="light"><IconFolder style={{ width: rem(14), height: rem(14) }} /></ThemeIcon>
              <Text size="sm" fw={500}>Project report</Text>
            </Group>
            <Anchor href={route('reports.project-report')} onClick={(e) => { e.preventDefault(); window.location.href = route('reports.project-report'); }} size="xs">
              Open <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
            </Anchor>
          </Group>

          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size="sm" radius="xl" color="orange" variant="light"><IconChartBar style={{ width: rem(14), height: rem(14) }} /></ThemeIcon>
              <Text size="sm" fw={500}>Workload report</Text>
            </Group>
            <Anchor href={route('reports.workload-report')} onClick={(e) => { e.preventDefault(); window.location.href = route('reports.workload-report'); }} size="xs">
              Open <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
            </Anchor>
          </Group>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
