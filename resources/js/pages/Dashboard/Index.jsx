import Layout from "@/layouts/MainLayout";
import { usePage } from "@inertiajs/react";
import { Grid, Group, SimpleGrid, Stack, Title, Text, SegmentedControl } from "@mantine/core";
import { useState } from "react";
import DashboardStats from "./Cards/DashboardStats";
import OverdueTasks from "./Cards/OverdueTasks";
import { ProjectCard } from "./Cards/ProjectCard";
import RecentComments from "./Cards/RecentComments";
import RecentlyAssignedTasks from "./Cards/RecentlyAssignedTasks";
import TeamCapacityCard from "./Cards/TeamCapacityCard";
import TeamInsightsCard from "./Cards/TeamInsights";
import RecentVcs from "./Cards/RecentVcs";

const Dashboard = () => {
  const { projects, overdueTasks, recentlyAssignedTasks, recentComments, teamCapacity } = usePage().props;
  const [projectView, setProjectView] = useState("cards");

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Title>Dashboard</Title>
      </Group>

      {/* Summary stats row */}
      <DashboardStats
        projects={projects}
        overdueTasks={overdueTasks}
        recentlyAssignedTasks={recentlyAssignedTasks}
      />

      {/* Team capacity + Team insights */}
      <Grid gutter="lg">
        {teamCapacity && (
          <Grid.Col span={{ base: 12, md: 8 }}>
            <TeamCapacityCard capacityData={teamCapacity} />
          </Grid.Col>
        )}
        <Grid.Col span={{ base: 12, md: teamCapacity ? 4 : 12 }}>
          <TeamInsightsCard />
        </Grid.Col>
      </Grid>

      {/* Projects section */}
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={3}>Projects</Title>
          <SegmentedControl
            size="xs"
            value={projectView}
            onChange={setProjectView}
            data={[
              { label: "Cards", value: "cards" },
              { label: "Compact", value: "compact" },
            ]}
          />
        </Group>

        {projectView === "cards" ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </SimpleGrid>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} compact />
            ))}
          </SimpleGrid>
        )}

        {projects.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">No projects found.</Text>
        )}
      </Stack>

      {/* Activity: Overdue + Recent + Comments */}
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <OverdueTasks tasks={overdueTasks} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <RecentlyAssignedTasks tasks={recentlyAssignedTasks} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <RecentComments comments={recentComments} />
        </Grid.Col>
      </Grid>

      {/* VCS activity */}
      <RecentVcs projects={projects} />
    </Stack>
  );
};

Dashboard.layout = (page) => <Layout title="Dashboard">{page}</Layout>;

export default Dashboard;
