// filepath: resources/js/pages/Projects/Index/ProjectsTree.jsx
import ProjectCard from './ProjectCard';
import MiniProjectCard from './MiniProjectCard';
import { Flex, ActionIcon, Group, Button } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import classes from './css/ProjectsTree.module.css';

function TreeNode({ node, depth = 0, expandAllVersion }) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const [expanded, setExpanded] = useState(true);
  const [version, setVersion] = useState(expandAllVersion);

  if (version !== expandAllVersion) {
    // when version changes, reset expanded based on expandAllVersion sign
    setVersion(expandAllVersion);
    setExpanded(expandAllVersion > 0);
  }

  return (
    <div className={classes.childrenWrapper}>
      <div className={classes.treeNode} style={{ marginLeft: depth === 0 ? 16 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasChildren && (
            <ActionIcon variant="subtle" size="sm" onClick={() => setExpanded(e => !e)}>
              {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </ActionIcon>
          )}
          <MiniProjectCard project={node} />
        </div>
      </div>

      {hasChildren && expanded && (
        <div style={{ marginLeft: 16 }}>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} expandAllVersion={expandAllVersion} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsTree({ items }) {
  const [expandAllVersion, setExpandAllVersion] = useState(1); // positive = expanded, negative = collapsed

  const expandAll = () => setExpandAllVersion(Math.abs(expandAllVersion) + 1);
  const collapseAll = () => setExpandAllVersion(-(Math.abs(expandAllVersion) + 1));

  return (
    <>
      <Group gap="xs" mt="lg">
        <Button size="xs" variant="light" onClick={expandAll}>Expand all</Button>
        <Button size="xs" variant="subtle" onClick={collapseAll}>Collapse all</Button>
      </Group>

      <Flex mt="md" gap="lg" justify="flex-start" align="flex-start" direction="row" wrap="wrap">
        {items.map((item) => (
          <div key={item.id}>
            <ProjectCard item={item} />
            {/*{Array.isArray(item.children) && item.children.map((child) => (*/}
            {/*  <TreeNode key={child.id} node={child} expandAllVersion={expandAllVersion} />*/}
            {/*))}*/}
          </div>
        ))}
      </Flex>
    </>
  );
}
