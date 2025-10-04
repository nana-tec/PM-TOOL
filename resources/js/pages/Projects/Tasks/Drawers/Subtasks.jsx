import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, List, Loader, Text, TextInput } from '@mantine/core';
import { IconPlus, IconChevronRight } from '@tabler/icons-react';
import axios from 'axios';

export default function Subtasks({ parent, projectId }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');

  const parentId = parent?.id;

  useEffect(() => {
    // Initialize from preloaded children, else fetch
    if (parent?.children && parent.children.length) {
      setItems(parent.children);
      return;
    }
    if (!parentId) return;
    setLoading(true);
    axios
      .get(route('projects.tasks.subtasks', [projectId, parentId]))
      .then((res) => setItems(res.data.subtasks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [parentId]);

  const canAdd = useMemo(() => name.trim().length > 0 && !loading, [name, loading]);

  const addSubtask = async () => {
    if (!canAdd) return;
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        group_id: parent.group_id,
        assigned_to_user_id: null,
        parent_id: parentId,
        description: null,
        estimation: null,
        pricing_type: parent.pricing_type || 'hourly',
        fixed_price: null,
        due_on: null,
        hidden_from_clients: !!parent.hidden_from_clients,
        billable: !!parent.billable,
        subscribed_users: [],
        labels: [],
      };

      const res = await axios.post(
        route('projects.tasks.store', [projectId]),
        payload,
        { headers: { Accept: 'application/json' }, progress: false }
      );

      const created = res.data.task;
      setItems((prev) => [...prev, created]);
      setName('');
    } catch (e) {
      alert('Failed to create subtask');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Subtasks</Text>
      </Group>

      <Group gap="sm" align="center" mb="sm">
        <TextInput
          placeholder="Add a subtask..."
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          style={{ flex: 1 }}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSubtask();
            }
          }}
        />
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={addSubtask}
          disabled={!canAdd}
          loading={loading}
        >
          Add
        </Button>
      </Group>

      {loading && items.length === 0 ? (
        <Loader size="sm" />
      ) : (
        <List spacing="xs" center>
          {items.map((t) => (
            <List.Item key={t.id} icon={<IconChevronRight size={14} />}>#{t.number} · {t.name}</List.Item>
          ))}
        </List>
      )}
    </div>
  );
}

