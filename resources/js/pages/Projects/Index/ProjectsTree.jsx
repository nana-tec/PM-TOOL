// filepath: resources/js/pages/Projects/Index/ProjectsTree.jsx
import ProjectCard from './ProjectCard';
import { ActionIcon, Badge, Flex, Group, Button, Card, Stack, Text, Progress, Tooltip, rem } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconFolder, IconFolderOpen } from '@tabler/icons-react';
import { useState } from 'react';
import { redirectTo } from '@/utils/route';
import classes from './css/ProjectsTree.module.css';

function TreeNode({ node, depth = 0, expandAllVersion }) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const [expanded, setExpanded] = useState(depth < 2);
  const [version, setVersion] = useState(expandAllVersion);

  if (version !== expandAllVersion) {
    setVersion(expandAllVersion);
    setExpanded(expandAllVersion > 0);
  }

  const completedPercent = node.all_tasks_count > 0
    ? Math.round((node.completed_tasks_count / node.all_tasks_count) * 100)
    : 0;

  return (
    <div className={classes.childrenWrapper}>
      <Card
        withBorder
        radius="md"
        p="sm"
        mb={4}
        ml={depth * 24}
        style={{ cursor: 'pointer', borderLeft: depth > 0 ? `3px solid var(--mantine-color-blue-${Math.min(4 + depth, 9)})` : undefined }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {hasChildren && (
              <ActionIcon variant="subtle" size="sm" onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}>
                {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </ActionIcon>
            )}
            {!hasChildren && <div style={{ width: 28 }} />}
            {expanded && hasChildren ? (
              <IconFolderOpen size={18} style={{ color: 'var(--mantine-color-blue-5)', flexShrink: 0 }} />
            ) : (
              <IconFolder size={18} style={{ color: 'var(--mantine-color-blue-5)', flexShrink: 0 }} />
            )}
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} size="sm" lineClamp={1} onClick={() => redirectTo('projects.open', node.id)} style={{ cursor: 'pointer' }}>
                {node.name}
              </Text>
              {node.client_company?.name && (
                <Text size="xs" c="dimmed">{node.client_company.name}</Text>
              )}
            </Stack>
          </Group>

          <Group gap="md" wrap="nowrap">
            {hasChildren && (
              <Badge size="xs" variant="light" color="grape">
                {node.children.length} sub
              </Badge>
            )}
            <Tooltip label={`${completedPercent}% complete (${node.completed_tasks_count || 0}/${node.all_tasks_count || 0})`}>
              <Stack gap={2} style={{ minWidth: 80 }}>
                <Text size="xs" fw={500} ta="right">{completedPercent}%</Text>
                <Progress value={completedPercent} size="xs" radius="xl" color={completedPercent >= 80 ? 'green' : completedPercent >= 40 ? 'blue' : 'gray'} />
              </Stack>
            </Tooltip>
            <Button size="xs" variant="light" onClick={() => redirectTo('projects.tasks', node.id)}>
              Tasks
            </Button>
          </Group>
        </Group>
      </Card>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} expandAllVersion={expandAllVersion} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsTree({ items }) {
  const [expandAllVersion, setExpandAllVersion] = useState(1);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'tree'

  const expandAll = () => setExpandAllVersion(Math.abs(expandAllVersion) + 1);
  const collapseAll = () => setExpandAllVersion(-(Math.abs(expandAllVersion) + 1));

  return (
    <>
      <Group gap="xs" mt="lg" mb="md" justify="space-between">
        <Group gap="xs">
          <Button size="xs" variant={viewMode === 'cards' ? 'filled' : 'light'} onClick={() => setViewMode('cards')}>Card View</Button>
          <Button size="xs" variant={viewMode === 'tree' ? 'filled' : 'light'} onClick={() => setViewMode('tree')}>Tree View</Button>
        </Group>
        {viewMode === 'tree' && (
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={expandAll}>Expand all</Button>
            <Button size="xs" variant="subtle" onClick={collapseAll}>Collapse all</Button>
          </Group>
        )}
      </Group>

      {viewMode === 'tree' ? (
        <Stack gap={0}>
          {items.map((item) => (
            <TreeNode key={item.id} node={item} expandAllVersion={expandAllVersion} />
          ))}
        </Stack>
      ) : (
        <Flex mt="md" gap="lg" justify="flex-start" align="flex-start" direction="row" wrap="wrap">
          {items.map((item) => (
            <div key={item.id}>
              <ProjectCard item={item} />
            </div>
          ))}
        </Flex>
      )}
    </>
  );
}
