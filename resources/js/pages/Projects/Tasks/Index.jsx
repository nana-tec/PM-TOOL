import { EmptyResult } from "@/components/EmptyResult";
import useTaskFiltersStore from "@/hooks/store/useTaskFiltersStore";
import useTaskGroupsStore from "@/hooks/store/useTaskGroupsStore";
import useTasksStore from "@/hooks/store/useTasksStore";
import usePreferences from "@/hooks/usePreferences";
import useWebSockets from "@/hooks/useWebSockets";
import Layout from "@/layouts/MainLayout";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { usePage } from "@inertiajs/react";
import { Button, Grid, Stack, Box, Group, SegmentedControl, Switch } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { CreateTaskDrawer } from "./Drawers/CreateTaskDrawer";
import { EditTaskDrawer } from "./Drawers/EditTaskDrawer";
import ArchivedItems from "./Index/Archive/ArchivedItems";
import Filters from "./Index/Filters";
import FiltersDrawer from "./Index/FiltersDrawer";
import Header from "./Index/Header";
import VcsPanel from "@/pages/Projects/Vcs/Panel";
import VcsDashboard from "@/pages/Projects/Vcs/Dashboard";
import CreateTasksGroupModal from "./Index/Modals/CreateTasksGroupModal";
import TaskGroup from "./Index/TaskGroup";
import classes from "./css/Index.module.css";
import NotesPanel from "@/pages/Projects/Notes/Panel";
import GanttChart from "@/components/GanttChart";
import { redirectTo } from "@/utils/route";

let currentProject = null;

const TasksIndex = () => {
  const { project, taskGroups, groupedTasks, openedTask } = usePage().props;
  currentProject = project;

  const { groups, setGroups, reorderGroup } = useTaskGroupsStore();
  const { tasks, setTasks, addTask, reorderTask, moveTask } = useTasksStore();
  const { hasUrlParams } = useTaskFiltersStore();
  const { initProjectWebSocket } = useWebSockets();
  const { tasksView, setTasksView } = usePreferences();

  const [ganttZoom, setGanttZoom] = useState('month');
  const [ganttGroupByProject, setGanttGroupByProject] = useState(false);

  const usingFilters = hasUrlParams();

  useEffect(() => {
    setGroups(taskGroups);
    setTasks(groupedTasks);
    if (openedTask) addTask(openedTask);
  }, [taskGroups, groupedTasks]);

  useEffect(() => {
    return initProjectWebSocket(project);
  }, []);

  // Initialize view from query param (e.g., ?view=gantt)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'gantt') setTasksView('gantt');
    if (view === 'vcs') setTasksView('vcs');
  }, []);

  const onDragEnd = ({ source, destination }) => {
    if (!destination) {
      return;
    }
    if (source.droppableId.includes("tasks") && destination.droppableId.includes("tasks")) {
      if (source.droppableId === destination.droppableId) {
        reorderTask(source, destination);
      } else {
        moveTask(source, destination);
      }
    } else {
      reorderGroup(source.index, destination.index);
    }
  };

  // Flatten all tasks across groups to feed into Gantt
  const allTasks = useMemo(() => {
    const items = [];
    groups.forEach((group) => {
      const list = tasks[group.id] || [];
      list.forEach((t) => {
        items.push({
          ...t,
          project_id: project.id,
          project_name: project.name,
        });
      });
    });
    return items;
  }, [groups, tasks, project]);

  return (
    <>
      <Header />

      {can("create task") && <CreateTaskDrawer />}
      <EditTaskDrawer />

      {tasksView === 'gantt' && (
        <Group mt="md" mb="sm" gap="md">
          <SegmentedControl
            size="sm"
            value={ganttZoom}
            onChange={setGanttZoom}
            data={[
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
              { label: 'Quarter', value: 'quarter' },
            ]}
          />
          <Switch
            size="sm"
            checked={ganttGroupByProject}
            onChange={(e) => setGanttGroupByProject(e.currentTarget.checked)}
            label="Group by project"
          />
        </Group>
      )}

      <Grid columns={12} gutter={50} mt="xl" className={`${tasksView}-view`}>
        {tasksView === 'vcs' && (
          <>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <VcsDashboard projectId={project.id} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <VcsPanel projectId={project.id} />
            </Grid.Col>
          </>
        )}
        {!route().params.archived ? (
          <Grid.Col span={tasksView === "list" ? 9 : (tasksView === 'vcs' ? 0 : 12)} style={{ display: tasksView === 'vcs' ? 'none' : undefined }}>
            {tasksView === 'gantt' ? (
              <GanttChart
                tasks={allTasks}
                zoom={ganttZoom}
                groupByProject={ganttGroupByProject}
                onBarClick={(task) => redirectTo("projects.tasks.open", [project.id, task.id])}
              />
            ) : groups.length ? (
              <>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable
                    droppableId="groups"
                    direction={tasksView === "list" ? "vertical" : "horizontal"}
                    type="group"
                  >
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        <div className={classes.viewport}>
                          {groups
                            .filter(
                              (group) =>
                                !usingFilters || (usingFilters && tasks[group.id]?.length > 0),
                            )
                            .map((group, index) => (
                              <TaskGroup
                                key={group.id}
                                index={index}
                                group={group}
                                tasks={tasks[group.id] || []}
                              />
                            ))}
                          {provided.placeholder}
                          {!route().params.archived && can("create task group") && (
                            <Button
                              leftSection={<IconPlus size={14} />}
                              variant="transparent"
                              size="sm"
                              mt={14}
                              m={4}
                              radius="xl"
                              onClick={CreateTasksGroupModal}
                              style={{ width: "200px" }}
                            >
                              Add {tasksView === "list" ? "tasks group" : "group"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </>
            ) : (
              <EmptyResult title="No tasks found" subtitle="or none match your search criteria" />
            )}
          </Grid.Col>
        ) : (
          <Grid.Col span={tasksView === "list" ? 9 : 12}>
            <ArchivedItems groups={groups} tasks={tasks} />
          </Grid.Col>
        )}
        {tasksView === "list" ? (
           <Grid.Col span={3}>
             <Stack>
               <Filters />
               <Box mt="md">
                 <NotesPanel projectId={project.id} />
               </Box>
             </Stack>
           </Grid.Col>
        ) : (
           <>
             <Grid.Col span={12}>
               <FiltersDrawer />
             </Grid.Col>
            <Grid.Col span={12} style={{ display: tasksView === 'vcs' ? 'none' : undefined }}>
               <NotesPanel projectId={project.id} />
             </Grid.Col>
           </>
         )}
      </Grid>
    </>
  );
};

TasksIndex.layout = (page) => <Layout title={currentProject?.name}>{page}</Layout>;

export default TasksIndex;
