import { useState } from 'react';
import { ActionIcon, Badge, Button, Divider, Group, Loader, Modal, MultiSelect, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { IconHistory, IconRestore } from '@tabler/icons-react';
import axios from 'axios';

const allowedFieldLabels = {
  name: 'Name',
  description: 'Description',
  due_on: 'Due date',
  estimation: 'Estimation',
  assigned_to_user_id: 'Assignee',
  pricing_type: 'Pricing type',
  fixed_price: 'Fixed price',
  hidden_from_clients: 'Hidden from clients',
  billable: 'Billable',
  group_id: 'Task group',
  completed_at: 'Completed at',
};

export default function TaskHistory({ task, onRestored }) {
  const projectId = task?.project_id;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [selectedFields, setSelectedFields] = useState({}); // { [auditId]: [fields] }

  const openHistory = async () => {
    if (!projectId || !task?.id) return;
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await axios.get(route('projects.tasks.history', [projectId, task.id]));
      setItems(data.history || []);
    } catch (e) {
      console.error(e);
      alert('Failed to load task history');
    } finally {
      setLoading(false);
    }
  };

  const onSelectFields = (auditId, fields) => {
    setSelectedFields(prev => ({ ...prev, [auditId]: fields }));
  };

  const restore = async (auditId) => {
    if (!projectId || !task?.id) return;
    const fields = selectedFields[auditId] || [];
    setRestoring(auditId);
    try {
      const payload = fields.length ? { fields } : {};
      const { data } = await axios.post(
        route('projects.tasks.history.restore', [projectId, task.id, auditId]),
        payload
      );
      const updated = data.task;

      // Update local store with restored fields (or all allowed fields if none specified)
      const useTasksStore = (await import('@/hooks/store/useTasksStore')).default;
      const { updateTaskLocally } = useTasksStore.getState();
      const keysToApply = fields.length ? fields : Object.keys(allowedFieldLabels);
      keysToApply.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(updated, k)) {
          updateTaskLocally(task.id, k, updated[k]);
        }
      });

      // Notify parent to resync its local state (inputs, editor, etc.)
      if (typeof onRestored === 'function') {
        onRestored(updated);
      }

      setOpen(false);
    } catch (e) {
      console.error(e);
      alert('Failed to restore this version');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <>
      <Tooltip label="View history" withArrow>
        <ActionIcon variant="light" color="gray" onClick={openHistory} aria-label="View history">
          <IconHistory size={16} />
        </ActionIcon>
      </Tooltip>

      <Modal opened={open} onClose={() => setOpen(false)} title={`Task #${task?.number} history`} size="lg">
        {loading ? (
          <Group justify="center" my="md"><Loader size="sm" /></Group>
        ) : items.length === 0 ? (
          <Text c="dimmed">No history available.</Text>
        ) : (
          <ScrollArea.Autosize mah={400} type="scroll">
            <Stack>
              {items.map((h) => {
                const changedKeys = [
                  ...Object.keys(h.old_values || {}),
                  ...Object.keys(h.new_values || {}),
                ].filter((v, i, arr) => arr.indexOf(v) === i);
                const selectable = changedKeys.filter((k) => Object.keys(allowedFieldLabels).includes(k));
                const options = selectable.map((k) => ({ value: k, label: allowedFieldLabels[k] }));

                return (
                  <div key={h.id}>
                    <Group gap="xs" mb={6} justify="space-between" wrap="nowrap">
                      <Group gap="xs">
                        <Badge size="xs" variant="light" color={h.event === 'created' ? 'green' : h.event === 'updated' ? 'blue' : 'gray'}>
                          {h.event}
                        </Badge>
                        <Text size="xs" c="dimmed">{new Date(h.created_at).toLocaleString()}</Text>
                      </Group>
                      {can('edit task') && (
                        <Button size="xs" variant="light" leftSection={<IconRestore size={14} />} onClick={() => restore(h.id)} loading={restoring === h.id}>
                          Restore
                        </Button>
                      )}
                    </Group>

                    {selectable.length > 0 && (
                      <MultiSelect
                        size="xs"
                        data={options}
                        value={selectedFields[h.id] || []}
                        onChange={(vals) => onSelectFields(h.id, vals)}
                        placeholder="Restore specific fields (optional)"
                        searchable
                        clearable
                      />
                    )}

                    {h.event === 'updated' && selectable.length > 0 && (
                      <Stack gap={4} mt="xs">
                        <Text size="xs" c="dimmed">Changed fields: {selectable.map(k => allowedFieldLabels[k]).join(', ')}</Text>
                      </Stack>
                    )}

                    <Divider my="sm" />
                  </div>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Modal>
    </>
  );
}
