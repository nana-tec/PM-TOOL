// filepath: resources/js/pages/Projects/Index/MiniProjectCard.jsx
import { Link } from '@inertiajs/react';
import { Card, Group, Text, Badge } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';

export default function MiniProjectCard({ project }) {
  const count = project.children_count ?? (project.children ? project.children.length : 0);
  const tasksCount = project.tasks_count ?? 0;
  return (
    <Link href={route('projects.open', project.id)} style={{ textDecoration: 'none' }}>
      <Card withBorder padding="sm" radius="md" w={280}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <IconFolder size={16} style={{ color: 'var(--mantine-color-blue-5)', flexShrink: 0 }} />
            <Text fz={14} fw={600} lineClamp={1}>{project.name}</Text>
          </Group>
          <Group gap={6} wrap="nowrap">
            {tasksCount > 0 && <Badge size="xs" variant="outline" color="gray">{tasksCount} tasks</Badge>}
            {count > 0 && <Badge size="xs" variant="light" color="grape">{count} sub</Badge>}
          </Group>
        </Group>
      </Card>
    </Link>
  );
}
