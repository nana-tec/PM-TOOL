import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import axios from 'axios';
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Select,
  NumberInput,
  Text,
  TextInput,
  Tooltip,
  rem,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPlus,
  IconIndentIncrease,
  IconIndentDecrease,
  IconTrash,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function toTree(items) {
  const map = new Map();
  items.forEach(i => map.set(i.id, { ...i, children: [] }));
  const roots = [];
  items.forEach(i => {
    const node = map.get(i.id);
    if (i.parent_id && map.has(i.parent_id)) {
      map.get(i.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortChildren = node => {
    node.children.sort((a, b) => (a.order_column ?? 0) - (b.order_column ?? 0));
    node.children.forEach(sortChildren);
  };
  roots.sort((a, b) => (a.order_column ?? 0) - (b.order_column ?? 0));
  roots.forEach(sortChildren);
  return roots;
}

function flattenTree(nodes, parentId = null, acc = [], startIndex = 0) {
  let index = startIndex;
  nodes.forEach(n => {
    acc.push({ id: n.id, parent_id: parentId, order_column: index++ });
    if (n.children?.length) {
      index = flattenTree(n.children, n.id, acc, 0).nextIndex;
    }
  });
  return { list: acc, nextIndex: index };
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function findList(tree, droppableId) {
  const targetParentId = droppableId === 'root' ? null : Number(droppableId);
  if (targetParentId === null) return tree;
  const stack = [...tree];
  while (stack.length) {
    const node = stack.shift();
    if (node.id === targetParentId) return node.children;
    if (node.children?.length) stack.push(...node.children);
  }
  return null;
}

function extractNode(tree, id) {
  const stack = [{ list: tree, parent: null }];
  while (stack.length) {
    const { list } = stack.shift();
    const idx = list.findIndex(n => n.id === id);
    if (idx !== -1) {
      const [node] = list.splice(idx, 1);
      return node;
    }
    for (const n of list) if (n.children?.length) stack.push({ list: n.children, parent: n });
  }
  return null;
}

export default function SubTasks({ task }) {
  const { project, usersWithAccessToProject } = usePage().props;
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState([]); // tree nodes

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        route('projects.tasks.subtasks.index', [project.id, task.id])
      );
      setNodes(toTree(data.subtasks || []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [task.id]);

  const persistReorder = async (tree) => {
    const { list } = flattenTree(tree);
    await axios.post(route('projects.tasks.subtasks.reorder', [project.id, task.id]), { items: list });
  };

  const addNode = async (parentId = null) => {
    const name = 'New subtask';
    const payload = { name, parent_id: parentId };
    const { data } = await axios.post(route('projects.tasks.subtasks.store', [project.id, task.id]), payload);
    setNodes(prev => {
      const tree = clone(prev);
      const newNode = { ...data.subtask, children: [] };
      if (parentId) {
        const attach = (arr) => {
          for (const n of arr) {
            if (n.id === parentId) { n.children.push(newNode); return true; }
            if (n.children && attach(n.children)) return true;
          }
          return false;
        };
        attach(tree);
      } else {
        tree.push(newNode);
      }
      persistReorder(tree);
      return tree;
    });
  };

  const updateNode = async (id, patch) => {
    await axios.put(route('projects.tasks.subtasks.update', [project.id, task.id, id]), patch);
    setNodes(prev => {
      const tree = clone(prev);
      const apply = (arr) => {
        arr.forEach(n => {
          if (n.id === id) Object.assign(n, patch);
          if (n.children?.length) apply(n.children);
        });
      };
      apply(tree);
      return tree;
    });
  };

  const removeNode = async (id) => {
    await axios.delete(route('projects.tasks.subtasks.destroy', [project.id, task.id, id]));
    setNodes(prev => {
      const tree = clone(prev);
      const remove = (arr) => {
        const idx = arr.findIndex(n => n.id === id);
        if (idx !== -1) { arr.splice(idx, 1); return true; }
        for (const n of arr) if (n.children && remove(n.children)) return true;
        return false;
      };
      remove(tree);
      persistReorder(tree);
      return tree;
    });
  };

  const indent = (id) => {
    setNodes(prev => {
      const tree = clone(prev);
      const process = (arr) => {
        const idx = arr.findIndex(n => n.id === id);
        if (idx !== -1) {
          if (idx > 0) {
            const node = arr.splice(idx, 1)[0];
            const parent = arr[idx - 1];
            parent.children = parent.children || [];
            parent.children.push(node);
          }
          return true;
        }
        for (const n of arr) if (n.children && process(n.children)) return true;
        return false;
      };
      process(tree);
      persistReorder(tree);
      return tree;
    });
  };

  const outdent = (id) => {
    setNodes(prev => {
      const tree = clone(prev);
      const process = (arr, parentArr) => {
        const idx = arr.findIndex(n => n.id === id);
        if (idx !== -1) {
          if (parentArr) {
            const node = arr.splice(idx, 1)[0];
            const parentIdx = parentArr.findIndex(n => n.children === arr);
            const insertAt = parentIdx + 1;
            parentArr.splice(insertAt, 0, node);
          }
          return true;
        }
        for (const n of arr) if (n.children && process(n.children, arr)) return true;
        return false;
      };
      process(tree, null);
      persistReorder(tree);
      return tree;
    });
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromList = findList(nodes, source.droppableId);
    const toList = findList(nodes, destination.droppableId);
    if (!fromList || !toList) return;

    const id = Number(draggableId.replace('subtask-', ''));

    setNodes(prev => {
      const tree = clone(prev);
      const moving = extractNode(tree, id);
      if (!moving) return prev;

      toList.splice(destination.index, 0, moving);
      persistReorder(tree);
      return tree;
    });
  };

  const Row = ({ node, depth }) => {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(node.name);

    useEffect(() => setName(node.name), [node.name]);

    const saveName = async () => {
      if (name && name !== node.name) await updateNode(node.id, { name });
      setEditing(false);
    };

    return (
      <Group justify='space-between' wrap='nowrap' ml={rem(depth * 16)} mt={4}>
        <Group gap='xs' wrap='nowrap'>
          <Checkbox
            checked={!!node.completed_at}
            onChange={e => updateNode(node.id, { completed_at: e.currentTarget.checked ? new Date().toISOString() : null })}
          />
          {editing ? (
            <TextInput
              size='xs'
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => e.key === 'Enter' && saveName()}
            />
          ) : (
            <Text size='sm' onDoubleClick={() => setEditing(true)}>{node.name}</Text>
          )}
        </Group>
        <Group gap='xs' wrap='wrap' align='center'>
          <Select
            placeholder='Assignee'
            size='xs'
            value={node.assigned_to_user_id?.toString() || null}
            onChange={(v) => updateNode(node.id, { assigned_to_user_id: v ? Number(v) : null })}
            data={usersWithAccessToProject.map(u => ({ value: u.id.toString(), label: u.name }))}
            clearable
            searchable
            style={{ minWidth: 160 }}
          />
          <DateInput
            size='xs'
            placeholder='Due date'
            value={node.due_on ? dayjs(node.due_on).toDate() : null}
            onChange={(d) => updateNode(node.id, { due_on: d ? dayjs(d).format('YYYY-MM-DD') : null })}
          />
          <NumberInput
            size='xs'
            placeholder='Est.'
            decimalScale={2}
            fixedDecimalScale
            min={0}
            allowNegative={false}
            step={0.5}
            value={node.estimation ?? ''}
            onChange={(val) => updateNode(node.id, { estimation: val ?? null })}
            style={{ width: 90 }}
          />
          <Tooltip label='Indent'>
            <ActionIcon size='sm' variant='subtle' onClick={() => indent(node.id)}>
              <IconIndentIncrease size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label='Outdent'>
            <ActionIcon size='sm' variant='subtle' onClick={() => outdent(node.id)}>
              <IconIndentDecrease size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label='Add child'>
            <ActionIcon size='sm' variant='subtle' onClick={() => addNode(node.id)}>
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label='Delete'>
            <ActionIcon size='sm' color='red' variant='subtle' onClick={() => removeNode(node.id)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    );
  };

  const Tree = ({ items, parentId }) => (
    <Droppable droppableId={parentId === null ? 'root' : String(parentId)}>
      {(dropProvided) => (
        <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
          {items.map((n, index) => (
            <Draggable key={n.id} draggableId={`subtask-${n.id}`} index={index}>
              {(dragProvided) => (
                <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                  <Row node={n} depth={parentId === null ? 0 : 1} />
                  {n.children?.length ? <Tree items={n.children} parentId={n.id} /> : null}
                </div>
              )}
            </Draggable>
          ))}
          {dropProvided.placeholder}
        </div>
      )}
    </Droppable>
  );

  return (
    <Paper withBorder p='sm'>
      <Group justify='space-between' mb='xs'>
        <Text fw={600}>Subtasks</Text>
        <Button size='xs' leftSection={<IconPlus size={14} />} onClick={() => addNode(null)}>
          Add subtask
        </Button>
      </Group>
      {loading ? (
        <Group justify='center' py='md'><Loader size='sm' /></Group>
      ) : nodes.length === 0 ? (
        <Text size='sm' c='dimmed'>No subtasks yet. Use Add subtask to create one.</Text>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Tree items={nodes} parentId={null} />
        </DragDropContext>
      )}
    </Paper>
  );
}
