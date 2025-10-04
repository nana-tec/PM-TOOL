import useTaskGroupsStore from "@/hooks/store/useTaskGroupsStore";
import useTaskFiltersStore from "@/hooks/store/useTaskFiltersStore";
import { usePage } from "@inertiajs/react";
import { ColorSwatch, Group, Stack, Text } from "@mantine/core";
import FilterButton from "./Filters/FilterButton";

export default function Filters() {
  const { usersWithAccessToProject, labels } = usePage().props;

  const { groups } = useTaskGroupsStore();
  const { filters, toggleArrayFilter, toggleObjectFilter, toggleValueFilter } =
    useTaskFiltersStore();

  const priorityOptions = [
    { value: "urgent", label: "Urgent" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const complexityOptions = [
    { value: "xs", label: "XS" },
    { value: "s", label: "S" },
    { value: "m", label: "M" },
    { value: "l", label: "L" },
    { value: "xl", label: "XL" },
  ];

  return (
    <>
      <Stack justify="flex-start" gap={24}>
        {groups.length > 0 && (
          <div>
            <Text fz="xs" fw={700} tt="uppercase" mb="sm">
              Task groups
            </Text>
            <Stack justify="flex-start" gap={6}>
              {groups.map((item) => (
                <FilterButton
                  key={item.id}
                  selected={filters.groups.includes(item.id)}
                  onClick={() => toggleArrayFilter("groups", item.id)}
                >
                  {item.name}
                </FilterButton>
              ))}
            </Stack>
          </div>
        )}

        {usersWithAccessToProject.length > 0 && (
          <div>
            <Text fz="xs" fw={700} tt="uppercase" mb="sm">
              Assignees
            </Text>
            <Stack justify="flex-start" gap={6}>
              {usersWithAccessToProject.map((item) => (
                <FilterButton
                  key={item.id}
                  selected={filters.assignees.includes(item.id)}
                  onClick={() => toggleArrayFilter("assignees", item.id)}
                >
                  {item.name}
                </FilterButton>
              ))}
            </Stack>
          </div>
        )}

        <div>
          <Text fz="xs" fw={700} tt="uppercase" mb="sm">
            Due date
          </Text>
          <Stack justify="flex-start" gap={6}>
            <FilterButton
              selected={filters.due_date.not_set === 1}
              onClick={() => toggleObjectFilter("due_date", "not_set")}
            >
              Not set
            </FilterButton>
            <FilterButton
              selected={filters.due_date.overdue === 1}
              onClick={() => toggleObjectFilter("due_date", "overdue")}
            >
              Overdue
            </FilterButton>
          </Stack>
        </div>

        <div>
          <Text fz="xs" fw={700} tt="uppercase" mb="sm">
            Status
          </Text>
          <Stack justify="flex-start" gap={6}>
            <FilterButton
              selected={filters.status === "completed"}
              onClick={() => toggleValueFilter("status", "completed")}
            >
              Completed
            </FilterButton>
          </Stack>
        </div>

        {labels.length > 0 && (
          <div>
            <Text fz="xs" fw={700} tt="uppercase" mb="sm">
              Labels
            </Text>
            <Stack justify="flex-start" gap={6}>
              {labels.map((item) => (
                <FilterButton
                  key={item.id}
                  selected={filters.labels.includes(item.id)}
                  onClick={() => toggleArrayFilter("labels", item.id)}
                  leftSection={<ColorSwatch color={item.color} size={18} />}
                >
                  {item.name}
                </FilterButton>
              ))}
            </Stack>
          </div>
        )}

        <div>
          <Text fz="xs" fw={700} tt="uppercase" mb="sm">
            Priority
          </Text>
          <Stack justify="flex-start" gap={6}>
            {priorityOptions.map((opt) => (
              <FilterButton
                key={opt.value}
                selected={filters.priorities.includes(opt.value)}
                onClick={() => toggleArrayFilter("priorities", opt.value)}
              >
                {opt.label}
              </FilterButton>
            ))}
          </Stack>
        </div>

        <div>
          <Text fz="xs" fw={700} tt="uppercase" mb="sm">
            Complexity
          </Text>
          <Stack justify="flex-start" gap={6}>
            {complexityOptions.map((opt) => (
              <FilterButton
                key={opt.value}
                selected={filters.complexities.includes(opt.value)}
                onClick={() => toggleArrayFilter("complexities", opt.value)}
              >
                {opt.label}
              </FilterButton>
            ))}
          </Stack>
        </div>

        <div>
          <Text fz="xs" fw={700} tt="uppercase" mb="sm">
            Sort by
          </Text>
          <Stack justify="flex-start" gap={6}>
            <FilterButton
              selected={filters.sort === "priority"}
              onClick={() => toggleValueFilter("sort", "priority")}
            >
              Priority (Urgent → Low)
            </FilterButton>
            <FilterButton
              selected={filters.sort === "complexity"}
              onClick={() => toggleValueFilter("sort", "complexity")}
            >
              Complexity (XL → XS)
            </FilterButton>
          </Stack>
        </div>

        <div>
          <Text fz="xs" fw={700} tt="uppercase" mb="sm">
            Legend
          </Text>
          <Stack gap={8}>
            <div>
              <Text size="xs" fw={600} mb={4}>
                Priority
              </Text>
              <Group gap={10}>
                <Group gap={6}>
                  <ColorSwatch color="red" size={14} />
                  <Text size="xs">Urgent</Text>
                </Group>
                <Group gap={6}>
                  <ColorSwatch color="orange" size={14} />
                  <Text size="xs">High</Text>
                </Group>
                <Group gap={6}>
                  <ColorSwatch color="blue" size={14} />
                  <Text size="xs">Medium</Text>
                </Group>
                <Group gap={6}>
                  <ColorSwatch color="gray" size={14} />
                  <Text size="xs">Low</Text>
                </Group>
              </Group>
            </div>
            <div>
              <Text size="xs" fw={600} mb={4}>
                Complexity
              </Text>
              <Group gap={10}>
                <Group gap={6}>
                  <ColorSwatch color="grape" size={14} />
                  <Text size="xs">XL</Text>
                </Group>
                <Group gap={6}>
                  <ColorSwatch color="violet" size={14} />
                  <Text size="xs">L</Text>
                </Group>
                <Group gap={6}>
                  <ColorSwatch color="gray" size={14} />
                  <Text size="xs">M</Text>
                </Group>
                <Group gap={6}>
                  <ColorSwatch color="cyan" size={14} />
                  <Text size="xs">S</Text>
                </Group>
                <Group gap={6}>
                  <ColorSwatch color="teal" size={14} />
                  <Text size="xs">XS</Text>
                </Group>
              </Group>
            </div>
          </Stack>
        </div>
      </Stack>
    </>
  );
}
