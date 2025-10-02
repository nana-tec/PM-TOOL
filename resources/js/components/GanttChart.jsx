import { useMemo } from "react";
import { Box, Group, ScrollArea, Stack, Text, Badge, Paper, Tooltip, useMantineTheme } from "@mantine/core";
import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";
dayjs.extend(minMax);
import classes from "./css/GanttChart.module.css";

// Map label keywords to Mantine palette names
const LABEL_TO_PALETTE = {
  urgent: 'red',
  high: 'orange',
  important: 'yellow',
  medium: 'teal',
  low: 'blue',
  bug: 'red',
  feature: 'teal',
  enhancement: 'grape',
  documentation: 'gray',
};

// Palette choices for projects (hashed to index)
const PROJECT_PALETTES = ['blue', 'grape', 'teal', 'red', 'violet', 'orange', 'indigo', 'cyan', 'lime', 'pink'];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

function getPaletteHex(theme, paletteName, shade) {
  const pal = theme.colors?.[paletteName];
  if (pal && pal[shade]) return pal[shade];
  // fallback to blue if palette missing
  return theme.colors?.blue?.[shade] || '#228be6';
}

function getProjectColorHex(theme, projectName, scheme) {
  const shade = scheme === 'dark' ? 5 : 6;
  const idx = hashString(projectName) % PROJECT_PALETTES.length;
  return getPaletteHex(theme, PROJECT_PALETTES[idx], shade);
}

function parseMaybeHexOrPalette(theme, value, scheme) {
  if (!value) return null;
  const v = String(value).trim();
  if (v.startsWith('#') && (v.length === 7 || v.length === 4)) return v;
  // treat as palette name
  const shade = scheme === 'dark' ? 5 : 6;
  return getPaletteHex(theme, v, shade);
}

function getTaskColorHex(theme, task, projectHex, scheme) {
  // Priority label mapping
  if (Array.isArray(task.labels) && task.labels.length > 0) {
    for (const label of task.labels) {
      const palette = LABEL_TO_PALETTE[(label.name || '').toLowerCase()];
      if (palette) return getPaletteHex(theme, palette, scheme === 'dark' ? 5 : 6);
    }
    // If label carries a color, support hex or palette name
    const primary = task.labels[0];
    const parsed = parseMaybeHexOrPalette(theme, primary?.color, scheme);
    if (parsed) return parsed;
  }
  return projectHex;
}

function getContrastColor(bgColor) {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * GanttChart
 * props:
 * - tasks: Array<{
 *     id: number|string,
 *     name: string,
 *     number?: number|string,
 *     project_id?: number|string,
 *     project_name?: string,
 *     assigned_to_user?: { id: number, name: string },
 *     due_on?: string|Date|null,
 *     assigned_at?: string|Date|null,
 *     created_at?: string|Date,
 *     completed_at?: string|Date|null,
 *     estimation?: number|null,
 *     labels?: Array<{ id: number|string, name: string, color?: string }>,
 *     progress?: number|null,
 *     dependencies?: Array<number|string>
 *   }>
 * - onBarClick?: (task) => void
 * - zoom?: 'week'|'month'|'quarter' (default 'month')
 * - groupByProject?: boolean (default true)
 * - maxDays?: number limit timeline span in days (default 180)
 */
export default function GanttChart({ tasks, onBarClick, zoom = 'month', groupByProject = true, maxDays = 180 }) {
  const theme = useMantineTheme();
  const scheme = theme.colorScheme || (document?.documentElement?.dataset?.mantineColorScheme ?? 'light');

  const zoomConfig = useMemo(() => {
    switch (zoom) {
      case 'week':
        return { stepDays: 1, dayWidth: 48, headerFormat: (d) => d.format('ddd MMM D'), subHeaderFormat: (d) => d.format('D') };
      case 'quarter':
        return { stepDays: 7, dayWidth: 32, headerFormat: (d) => `Week ${d.format('w')}`, subHeaderFormat: (d) => d.format('MMM D') };
      case 'month':
      default:
        return { stepDays: 1, dayWidth: 32, headerFormat: (d) => d.format('MMM D'), subHeaderFormat: (d) => d.format('ddd') };
    }
  }, [zoom]);

  const { startDate, columns, stepDays, sections, rowsFlat, pxPerDay, totalWidth, totalRows } = useMemo(() => {
    const { stepDays, dayWidth } = zoomConfig;

    if (!tasks || tasks.length === 0) {
      const today = dayjs().startOf('day');
      return { startDate: today, columns: 7, stepDays, sections: [], rowsFlat: [], pxPerDay: dayWidth / stepDays, totalWidth: 7 * dayWidth, totalRows: 0 };
    }

    const normalized = tasks.map((t) => {
      const due = t.due_on ? dayjs(t.due_on) : null;
      const assigned = t.assigned_at ? dayjs(t.assigned_at) : null;
      const created = t.created_at ? dayjs(t.created_at) : null;
      const completed = t.completed_at ? dayjs(t.completed_at) : null;

      // Heuristic for start and end
      let start = assigned || created || (due ? due.subtract(Math.min(Math.max(t.estimation || 0, 0), 1), 'day') : dayjs());
      let end = completed || due || start;
      if (end.isBefore(start)) {
        const tmp = start; start = end; end = tmp;
      }
      if (end.diff(start, 'day') === 0) {
        end = end.add(1, 'day');
      }

      const isMilestone = !!(t.is_milestone || (!t.estimation && !t.assigned_at && t.due_on));
      const progress = typeof t.progress === 'number' ? Math.max(0, Math.min(100, t.progress)) : (t.completed_at ? 100 : null);

      return {
        raw: t,
        id: t.id,
        title: t.name,
        number: t.number,
        projectId: t.project_id,
        projectName: t.project_name,
        start: start.startOf('day'),
        end: end.startOf('day'),
        isMilestone,
        progress,
        dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
      };
    });

    let min = dayjs.min(normalized.map((n) => n.start)) || dayjs();
    let max = dayjs.max(normalized.map((n) => n.end)) || dayjs().add(7, 'day');

    // Pad range
    min = min.startOf('day').subtract(2, 'day');
    max = max.startOf('day').add(2, 'day');

    // Snap weekly views to Monday to avoid drifting buckets
    if (stepDays === 7) {
      const dow = min.day(); // 0..6, 0 = Sunday
      const daysToMonday = (dow + 6) % 7; // convert to days to previous Monday
      min = min.subtract(daysToMonday, 'day');
    }

    const spanDays = Math.min(max.diff(min, 'day'), maxDays);
    const columns = Math.max(1, Math.ceil(spanDays / stepDays));

    const pxPerDay = dayWidth / stepDays;
    const totalWidth = columns * dayWidth;

    const daysFromMin = (d) => d.diff(min, 'day');

    // Compute per-row indices and pixel positions
    const withPos = normalized
      .map((n) => {
        const startDays = Math.max(0, daysFromMin(n.start));
        const endDays = Math.max(startDays + 1, Math.min(spanDays, daysFromMin(n.end)));

        const startIdx = Math.floor(startDays / stepDays);
        const endIdx = Math.max(startIdx + 1, Math.floor(endDays / stepDays));

        const leftPx = startDays * pxPerDay;
        const rightPx = endDays * pxPerDay;
        const widthPx = Math.max(pxPerDay * 0.8, rightPx - leftPx);

        return {
          ...n,
          startIdx,
          endIdx,
          leftPx,
          widthPx,
        };
      })
      .sort((a, b) => {
        if (a.projectName === b.projectName) {
          return a.start.valueOf() - b.start.valueOf();
        }
        return (a.projectName || '').localeCompare(b.projectName || '');
      });

    // Group by project
    const sections = groupByProject
      ? Object.values(withPos.reduce((acc, n) => {
          const key = n.projectName || 'Untitled';
          if (!acc[key]) acc[key] = { key, title: key, items: [] };
          acc[key].items.push(n);
          return acc;
        }, {}))
      : [{ key: 'all', title: null, items: withPos }];

    // Flat rows for dependency overlay with visual row indices (including section headers)
    let yCounter = 0;
    const rowsFlat = [];
    sections.forEach((s) => {
      if (s.title) yCounter += 1; // section header row
      s.items.forEach((item) => {
        rowsFlat.push({ sectionKey: s.key, item, yIndex: yCounter });
        yCounter += 1;
      });
    });

    return { startDate: min, columns, stepDays, sections, rowsFlat, pxPerDay, totalWidth, totalRows: yCounter };
  }, [tasks, zoomConfig, groupByProject, maxDays]);

  const dayWidth = zoomConfig.dayWidth;
  const headerFormat = zoomConfig.headerFormat;
  const subHeaderFormat = zoomConfig.subHeaderFormat;

  // Build dependency mapping for overlay, using pixel positions
  const dependencyLines = useMemo(() => {
    if (!rowsFlat.length) return [];
    const rowHeight = 56; // updated row height
    const barCenterOffset = 28; // center of bar within row

    const idToPosition = new Map();
    rowsFlat.forEach((row) => {
      idToPosition.set(row.item.id, {
        yIndex: row.yIndex,
        startPx: row.item.leftPx,
        endPx: row.item.leftPx + row.item.widthPx,
      });
    });

    const lines = [];
    rowsFlat.forEach((row) => {
      const fromPosList = (row.item.dependencies || []).map((depId) => idToPosition.get(depId)).filter(Boolean);
      fromPosList.forEach((from) => {
        const to = idToPosition.get(row.item.id);
        if (!to) return;
        const x1 = from.endPx;
        const y1 = (from.yIndex) * rowHeight + barCenterOffset;
        const x2 = to.startPx;
        const y2 = (to.yIndex) * rowHeight + barCenterOffset;
        lines.push({ x1, y1, x2, y2 });
      });
    });
    return lines;
  }, [rowsFlat]);

  // Theme-aware stroke color for dependency lines
  const depStroke = theme.colors?.gray?.[scheme === 'dark' ? 5 : 6] || '#868e96';

  return (
    <Paper className={classes.root} style={{ ['--gantt-day-width']: `${dayWidth}px` }}>
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <Text fw={600} c="gray.7" size="sm">
            Tasks
          </Text>
        </div>
        <div className={classes.headerRight}>
          <div className={classes.timelineHeader}>
            {/* Main header row */}
            <div className={classes.headerRow}>
              {Array.from({ length: columns }).map((_, i) => {
                const d = startDate.add(i * stepDays, 'day');
                const isToday = d.isSame(dayjs(), 'day');
                const isWeekend = [0, 6].includes(d.day());

                return (
                  <div
                    key={i}
                    className={`${classes.headerCell} ${isToday ? classes.today : ''} ${isWeekend ? classes.weekend : ''}`}
                    style={{ width: dayWidth }}
                  >
                    <Text size="xs" fw={500} c={isToday ? "blue.6" : "gray.6"}>
                      {headerFormat(d)}
                    </Text>
                  </div>
                );
              })}
            </div>

            {/* Sub header row for additional context */}
            <div className={classes.subHeaderRow}>
              {Array.from({ length: columns }).map((_, i) => {
                const d = startDate.add(i * stepDays, 'day');
                const isToday = d.isSame(dayjs(), 'day');
                const isWeekend = [0, 6].includes(d.day());

                return (
                  <div
                    key={i}
                    className={`${classes.subHeaderCell} ${isToday ? classes.today : ''} ${isWeekend ? classes.weekend : ''}`}
                    style={{ width: dayWidth }}
                  >
                    <Text size="xs" c={isToday ? "blue.5" : "gray.6"}>
                      {subHeaderFormat(d)}
                    </Text>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea type="auto" className={classes.viewport}>
        <div className={classes.content}>
          {/* Sections and rows */}
          {sections.map((section) => {
            const projectColor = getProjectColorHex(theme, section.title, scheme);

            return (
              <div key={section.key} className={classes.section}>
                {section.title && (
                  <div className={classes.sectionHeader}>
                    <div className={classes.sectionLeft}>
                      <div className={classes.projectIndicator} style={{ backgroundColor: projectColor }} />
                      <Text fw={600} size="sm">
                        {section.title}
                      </Text>
                      <Badge size="xs" variant="light" color="gray" ml="xs">
                        {section.items.length}
                      </Badge>
                    </div>
                    <div className={classes.sectionRight} style={{ width: totalWidth }}>
                      <div className={classes.sectionLine} style={{ backgroundColor: `${projectColor}20` }} />
                    </div>
                  </div>
                )}

                {section.items.map((task) => {
                  const taskColor = getTaskColorHex(theme, task.raw, projectColor, scheme);
                  const textColor = getContrastColor(taskColor);
                  const isOverdue = task.raw.due_on && dayjs(task.raw.due_on).isBefore(dayjs()) && !task.raw.completed_at;

                  return (
                    <div key={task.id} className={classes.taskRow}>
                      <div className={classes.taskLeft}>
                        <div className={classes.taskInfo}>
                          <Group gap={8} align="center">
                            <div
                              className={classes.taskIndicator}
                              style={{ backgroundColor: taskColor }}
                            />
                            <div className={classes.taskDetails}>
                              <Text size="sm" fw={500} lineClamp={1}>
                                {task.number && <span className={classes.taskNumber}>#{task.number}</span>}
                                {task.title}
                              </Text>
                              <Group gap={6} mt={2}>
                                {task.raw.assigned_to_user && (
                                  <Text size="xs" c="gray.6">
                                    {task.raw.assigned_to_user.name}
                                  </Text>
                                )}
                                {task.raw.labels?.slice(0, 2).map((label) => (
                                  <Badge
                                    key={label.id}
                                    size="xs"
                                    variant="dot"
                                    color={label.color || "gray"}
                                    style={{ textTransform: 'none' }}
                                  >
                                    {label.name}
                                  </Badge>
                                ))}
                                {isOverdue && (
                                  <Badge size="xs" color="red" variant="light">
                                    Overdue
                                  </Badge>
                                )}
                              </Group>
                            </div>
                          </Group>
                        </div>
                      </div>

                      <div className={classes.taskRight} style={{ width: totalWidth }}>
                        <div className={classes.gridBackground}>
                          {Array.from({ length: columns }).map((_, i) => {
                            const d = startDate.add(i * stepDays, 'day');
                            const isToday = d.isSame(dayjs(), 'day');
                            const isWeekend = [0, 6].includes(d.day());

                            return (
                              <div
                                key={i}
                                className={`${classes.gridCell} ${isToday ? classes.today : ''} ${isWeekend ? classes.weekend : ''}`}
                                style={{ width: dayWidth }}
                              />
                            );
                          })}
                        </div>

                        {task.isMilestone ? (
                          <Tooltip label={`Milestone: ${task.title}`} withArrow>
                            <div
                              className={classes.milestone}
                              style={{
                                left: task.leftPx + (pxPerDay / 2),
                                backgroundColor: taskColor,
                                borderColor: taskColor
                              }}
                              onClick={() => onBarClick?.(task.raw)}
                            />
                          </Tooltip>
                        ) : (
                          <Tooltip
                            label={`${task.start.format('MMM D')} → ${task.end.format('MMM D, YYYY')}${task.progress ? ` (${task.progress}% complete)` : ''}`}
                            withArrow
                          >
                            <div
                              className={`${classes.taskBar} ${isOverdue ? classes.overdue : ''}`}
                              style={{
                                left: task.leftPx,
                                width: task.widthPx,
                                backgroundColor: taskColor,
                                borderColor: taskColor
                              }}
                              onClick={() => onBarClick?.(task.raw)}
                            >
                              {typeof task.progress === 'number' && (
                                <div
                                  className={classes.progressBar}
                                  style={{
                                    width: `${task.progress}%`,
                                    backgroundColor: `${taskColor}40`
                                  }}
                                />
                              )}
                              <Text
                                size="xs"
                                fw={500}
                                c={textColor}
                                className={classes.taskBarLabel}
                                lineClamp={1}
                              >
                                {task.title}
                              </Text>
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Dependencies Overlay */}
          {dependencyLines.length > 0 && (
            <svg
              className={classes.overlay}
              style={{ left: 'var(--gantt-left-width)', top: 0, width: totalWidth, height: totalRows * 56 }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={depStroke} />
                </marker>
              </defs>
              {dependencyLines.map((l, idx) => (
                <path
                  key={idx}
                  d={`M ${l.x1} ${l.y1} L ${l.x1 + 16} ${l.y1} L ${l.x1 + 16} ${l.y2} L ${l.x2} ${l.y2}`}
                  stroke={depStroke}
                  strokeWidth={1.5}
                  fill="none"
                  markerEnd="url(#arrow)"
                  opacity={0.7}
                />)
              )}
            </svg>
          )}

          {rowsFlat.length === 0 && (
            <div className={classes.emptyState}>
              <Text size="sm" c="gray.6">No tasks to display</Text>
            </div>
          )}
        </div>
      </ScrollArea>
    </Paper>
  );
}
