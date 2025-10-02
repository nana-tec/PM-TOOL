import { Card, Grid, Group, Stack, Text, Title, useMantineTheme, SimpleGrid, Badge } from "@mantine/core";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { useMemo } from "react";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function ChartCard({ title, subtitle, children }) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={6} mb="sm">
        <Title order={5}>{title}</Title>
        {subtitle && (
          <Text size="xs" c="dimmed">{subtitle}</Text>
        )}
      </Stack>
      {children}
    </Card>
  );
}

export default function ProjectsSummary({ items }) {
  const theme = useMantineTheme();
  const scheme = theme.colorScheme || (document?.documentElement?.dataset?.mantineColorScheme ?? "light");
  const shadeStrong = scheme === "dark" ? 5 : 6;
  const shadeSoft = scheme === "dark" ? 3 : 4;

  const names = items.map((p) => p.name);
  const totals = items.map((p) => p.all_tasks_count ?? 0);
  const completed = items.map((p) => p.completed_tasks_count ?? 0);
  const overdue = items.map((p) => p.overdue_tasks_count ?? 0);
  const remaining = totals.map((t, i) => Math.max(0, t - (completed[i] + overdue[i])));

  const completionRate = items.map((p, i) => {
    const t = totals[i] || 1;
    return Math.round(((completed[i] ?? 0) / t) * 100);
  });

  // Color helpers
  const seriesColors = useMemo(() => {
    const palettes = ["blue", "grape", "teal", "red", "violet", "orange", "indigo", "cyan", "lime", "pink"];
    return names.map((_, idx) => theme.colors?.[palettes[idx % palettes.length]]?.[shadeStrong] || theme.colors.blue[shadeStrong]);
  }, [names, theme, shadeStrong]);

  const gridColor = scheme === "dark" ? theme.colors.dark[3] : theme.colors.gray[3];
  const labelColor = scheme === "dark" ? theme.colors.gray[4] : theme.colors.gray[6];

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: labelColor },
      },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: labelColor },
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: labelColor },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { color: labelColor } },
      tooltip: { enabled: true },
    },
  };

  // Datasets
  const tasksDistribution = {
    labels: names,
    datasets: [
      {
        label: "Tasks",
        data: totals,
        backgroundColor: seriesColors,
        borderColor: seriesColors,
        borderWidth: 1,
      },
    ],
  };

  const overdueByProject = {
    labels: names,
    datasets: [
      {
        label: "Overdue",
        data: overdue,
        backgroundColor: theme.colors.red[shadeStrong],
        borderColor: theme.colors.red[shadeSoft],
      },
    ],
  };

  const completionRateByProject = {
    labels: names,
    datasets: [
      {
        label: "Completion %",
        data: completionRate,
        backgroundColor: theme.colors.teal[shadeStrong],
        borderColor: theme.colors.teal[shadeSoft],
      },
    ],
  };

  const compositionStacked = {
    labels: names,
    datasets: [
      {
        label: "Completed",
        data: completed,
        backgroundColor: theme.colors.blue[shadeStrong],
        borderColor: theme.colors.blue[shadeSoft],
      },
      {
        label: "Overdue",
        data: overdue,
        backgroundColor: theme.colors.red[shadeStrong],
        borderColor: theme.colors.red[shadeSoft],
      },
      {
        label: "Remaining",
        data: remaining,
        backgroundColor: theme.colors.gray[shadeStrong],
        borderColor: theme.colors.gray[shadeSoft],
      },
    ],
  };

  const stackedOptions = {
    ...commonOptions,
    scales: {
      x: { stacked: true, grid: { color: gridColor }, ticks: { color: labelColor } },
      y: { stacked: true, grid: { color: gridColor }, ticks: { color: labelColor } },
    },
  };

  // Insights
  const topByCompletion = [...items]
    .map((p, i) => ({ name: p.name, rate: completionRate[i], total: totals[i] }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);

  const topByOverdue = [...items]
    .map((p, i) => ({ name: p.name, overdue: overdue[i] }))
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 3);

  const topBySize = [...items]
    .map((p, i) => ({ name: p.name, total: totals[i] }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  return (
    <Stack gap="lg" mt="lg">
      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
        <ChartCard title="Tasks distribution by project" subtitle="How many tasks each project contains">
          <div style={{ height: 280 }}>
            <Doughnut data={tasksDistribution} options={doughnutOptions} />
          </div>
        </ChartCard>

        <ChartCard title="Overdue tasks by project" subtitle="Projects with most issues">
          <div style={{ height: 280 }}>
            <Bar data={overdueByProject} options={commonOptions} />
          </div>
        </ChartCard>

        <ChartCard title="Completion rate by project" subtitle="Which projects are moving fastest">
          <div style={{ height: 280 }}>
            <Bar data={completionRateByProject} options={{ ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, max: 100 } } }} />
          </div>
        </ChartCard>
      </SimpleGrid>

      <ChartCard title="Composition by project" subtitle="Completed, overdue and remaining">
        <div style={{ height: 360 }}>
          <Bar data={compositionStacked} options={stackedOptions} />
        </div>
      </ChartCard>

      <Grid mt="sm">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="md">
            <Title order={5}>Top completion</Title>
            <Stack gap={6} mt="sm">
              {topByCompletion.map((x) => (
                <Group key={x.name} justify="space-between">
                  <Text size="sm">{x.name}</Text>
                  <Badge color="teal" variant="light">{x.rate}%</Badge>
                </Group>
              ))}
              {topByCompletion.length === 0 && <Text size="sm" c="dimmed">No data</Text>}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="md">
            <Title order={5}>Most overdue</Title>
            <Stack gap={6} mt="sm">
              {topByOverdue.map((x) => (
                <Group key={x.name} justify="space-between">
                  <Text size="sm">{x.name}</Text>
                  <Badge color="red" variant="light">{x.overdue}</Badge>
                </Group>
              ))}
              {topByOverdue.length === 0 && <Text size="sm" c="dimmed">No data</Text>}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="md">
            <Title order={5}>Largest projects</Title>
            <Stack gap={6} mt="sm">
              {topBySize.map((x) => (
                <Group key={x.name} justify="space-between">
                  <Text size="sm">{x.name}</Text>
                  <Badge color="blue" variant="light">{x.total}</Badge>
                </Group>
              ))}
              {topBySize.length === 0 && <Text size="sm" c="dimmed">No data</Text>}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

