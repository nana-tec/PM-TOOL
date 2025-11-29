// filepath: resources/js/pages/Projects/Index/MiniProjectCard.jsx
import { Link } from '@inertiajs/react';
import { Card, Group, Text, Badge } from '@mantine/core';

export default function MiniProjectCard({ project }) {
  const count = project.children_count ?? (project.children ? project.children.length : 0);
  const tasksCount = project.tasks_count ?? 0;
  return (
    <Link href={route('projects.open', project.id)} style={{ textDecoration: 'none' }}>
      <Card withBorder padding="sm" radius="md" w={260}>
        <Group justify="space-between" align="center">
          <Text fz={14} fw={600}>{project.name}</Text>
          <Group gap={6}>
            {tasksCount > 0 && <Badge size="xs" variant="outline" color="gray">{tasksCount} tasks</Badge>}
            {count > 0 && <Badge size="xs" variant="light">{count}</Badge>}
          </Group>
        </Group>
      </Card>
    </Link>
  );
}
