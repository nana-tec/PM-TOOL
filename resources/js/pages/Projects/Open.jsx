// filepath: resources/js/pages/Projects/Open.jsx
import Layout from '@/layouts/MainLayout';
import { usePage } from '@inertiajs/react';
import {
  Anchor, Badge, Breadcrumbs, Button, Card, Flex, Group, Progress,
  SimpleGrid, Stack, Text, Title, Tooltip,
} from '@mantine/core';
import { redirectTo } from '@/utils/route';
import {
  IconFolder, IconFolderPlus, IconChecks, IconClock, IconAlertTriangle,
  IconChartBar, IconListDetails,
} from '@tabler/icons-react';
import ProjectCard from './Index/ProjectCard';

const ProjectOpen = () => {
  const { item, children = [] } = usePage().props;

  const createSubProject = () => {
    redirectTo('projects.create', { parent_id: item.id });
  };

  const completedPercent = item.all_tasks_count > 0
    ? Math.round((item.completed_tasks_count / item.all_tasks_count) * 100)
    : 0;
  const pendingTasks = Math.max(0, (item.all_tasks_count || 0) - (item.completed_tasks_count || 0));

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <Anchor href="#" onClick={() => redirectTo('projects.index')} fz={14}>
          Projects
        </Anchor>
        <div>{item.name}</div>
      </Breadcrumbs>

      {/* Project header with stats */}
      <Card withBorder radius="md" p="lg" mb="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap="sm" style={{ flex: 1 }}>
            <Group gap="md">
              <IconFolder size={28} style={{ color: 'var(--mantine-color-blue-5)' }} />
              <div>
                <Title order={2}>{item.name}</Title>
                {item.client_company?.name && (
                  <Text c="dimmed" size="sm">{item.client_company.name}</Text>
                )}
              </div>
            </Group>
            {item.description && (
              <Text size="sm" c="dimmed" mt="xs">{item.description}</Text>
            )}
          </Stack>

          <Group gap="sm">
            <Button
              variant="light"
              leftSection={<IconListDetails size={16} />}
              onClick={() => redirectTo('projects.tasks', item.id)}
            >
              View Tasks
            </Button>
            <Button
              leftSection={<IconFolderPlus size={16} />}
              onClick={createSubProject}
            >
              Add Subproject
            </Button>
          </Group>
        </Group>

        {/* Stats row */}
        <SimpleGrid cols={{ base: 2, sm: 4, md: 5 }} spacing="md" mt="lg">
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <IconChartBar size={18} style={{ color: 'var(--mantine-color-blue-5)' }} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Progress</Text>
            </Group>
            <Text fw={700} size="xl" mt={4}>{completedPercent}%</Text>
            <Progress value={completedPercent} size="sm" radius="xl" mt={4}
              color={completedPercent >= 80 ? 'green' : completedPercent >= 40 ? 'blue' : 'gray'} />
          </Card>
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <IconChecks size={18} style={{ color: 'var(--mantine-color-green-5)' }} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Completed</Text>
            </Group>
            <Text fw={700} size="xl" c="green" mt={4}>{item.completed_tasks_count || 0}</Text>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <IconClock size={18} style={{ color: 'var(--mantine-color-orange-5)' }} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pending</Text>
            </Group>
            <Text fw={700} size="xl" c="orange" mt={4}>{pendingTasks}</Text>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <IconAlertTriangle size={18} style={{ color: 'var(--mantine-color-red-5)' }} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Overdue</Text>
            </Group>
            <Text fw={700} size="xl" c="red" mt={4}>{item.overdue_tasks_count || 0}</Text>
          </Card>
          <Card withBorder p="sm" radius="md">
            <Group gap="xs">
              <IconFolder size={18} style={{ color: 'var(--mantine-color-grape-5)' }} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Subprojects</Text>
            </Group>
            <Text fw={700} size="xl" mt={4}>{children.length}</Text>
          </Card>
        </SimpleGrid>

        {/* Team members */}
        {item.users_with_access && item.users_with_access.length > 0 && (
          <Group mt="md" gap="xs">
            <Text size="sm" c="dimmed" fw={500}>Team:</Text>
            {item.users_with_access.slice(0, 8).map((u) => (
              <Tooltip key={u.id} label={u.name} withArrow>
                <Badge size="sm" variant="light">{u.name.split(' ').map(w => w[0]).join('')}</Badge>
              </Tooltip>
            ))}
            {item.users_with_access.length > 8 && (
              <Badge size="sm" variant="light" color="gray">+{item.users_with_access.length - 8}</Badge>
            )}
          </Group>
        )}
      </Card>

      {/* Subprojects */}
      <Group justify="space-between" align="center" mb="md">
        <Title order={3}>
          Subprojects
          {children.length > 0 && (
            <Badge size="sm" variant="light" ml="sm">{children.length}</Badge>
          )}
        </Title>
      </Group>

      {children.length > 0 ? (
        <Flex gap="lg" justify="flex-start" align="flex-start" direction="row" wrap="wrap">
          {children.map((child) => (
            <ProjectCard key={child.id} item={child} linkTo="open" />
          ))}
        </Flex>
      ) : (
        <Card withBorder radius="md" p="xl" ta="center">
          <IconFolder size={40} style={{ color: 'var(--mantine-color-gray-4)', margin: '0 auto' }} />
          <Text c="dimmed" mt="sm">No subprojects yet.</Text>
          <Button size="sm" variant="light" mt="md" onClick={createSubProject}>
            Create first subproject
          </Button>
        </Card>
      )}
    </>
  );
};

ProjectOpen.layout = (page) => <Layout title="Project">{page}</Layout>;

export default ProjectOpen;
