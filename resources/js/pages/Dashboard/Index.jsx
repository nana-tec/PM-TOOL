import Layout from "@/layouts/MainLayout";
import { usePage } from "@inertiajs/react";
import { Title } from "@mantine/core";
import Masonry from "react-masonry-css";
import OverdueTasks from "./Cards/OverdueTasks";
import { ProjectCard } from "./Cards/ProjectCard";
import RecentComments from "./Cards/RecentComments";
import RecentlyAssignedTasks from "./Cards/RecentlyAssignedTasks";
import TeamCapacityCard from "./Cards/TeamCapacityCard";
import TeamInsightsCard from "./Cards/TeamInsights";
import RecentVcs from "./Cards/RecentVcs";
import classes from "./css/Index.module.css";

const Dashboard = () => {
  const { projects, overdueTasks, recentlyAssignedTasks, recentComments, teamCapacity } = usePage().props;

  const breakpointColumns = {
    default: 3,
    1100: 2,
    700: 1,
  };

  return (
    <>
      <Title mb="xl">Dashboard</Title>
      <Masonry
        breakpointCols={breakpointColumns}
        className={classes.myMasonryGrid}
        columnClassName={classes.myMasonryGridColumn}
      >
        {teamCapacity && <TeamCapacityCard capacityData={teamCapacity} />}
        <TeamInsightsCard />
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        <RecentVcs projects={projects} />
        <OverdueTasks tasks={overdueTasks} />
        <RecentlyAssignedTasks tasks={recentlyAssignedTasks} />
        <RecentComments comments={recentComments} />
      </Masonry>
    </>
  );
};

Dashboard.layout = (page) => <Layout title="Dashboard">{page}</Layout>;

export default Dashboard;
