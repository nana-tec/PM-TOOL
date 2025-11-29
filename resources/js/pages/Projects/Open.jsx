// filepath: resources/js/pages/Projects/Open.jsx
import Layout from '@/layouts/MainLayout';
import { usePage } from '@inertiajs/react';
import { Anchor, Breadcrumbs, Button, Flex, Group, Title } from '@mantine/core';
import { redirectTo } from '@/utils/route';
import ProjectCard from './Index/ProjectCard';

const ProjectOpen = () => {
  const { item, children = [] } = usePage().props;

  const createSubProject = () => {
    redirectTo('projects.create', { parent_id: item.id });
  };

  return (
    <>
      <Breadcrumbs fz={14} mb={30}>
        <Anchor href="#" onClick={() => redirectTo('projects.index')} fz={14}>
          Projects
        </Anchor>
        <div>{item.name}</div>
      </Breadcrumbs>

      <Group justify="space-between" align="center" mb="md">
        <Title order={2}>Project</Title>
        <Button size="xs" onClick={createSubProject}>Create subproject under this</Button>
      </Group>

      <ProjectCard item={item} />

      <Title order={3} mt="xl">Subprojects</Title>

      {children.length > 0 ? (
        <Flex mt="md" gap="lg" justify="flex-start" align="flex-start" direction="row" wrap="wrap">
          {children.map((child) => (
            <ProjectCard key={child.id} item={child} linkTo="tasks" />
          ))}
        </Flex>
      ) : (
        <div>No subprojects</div>
      )}
    </>
  );
};

ProjectOpen.layout = (page) => <Layout title="Project">{page}</Layout>;

export default ProjectOpen;
