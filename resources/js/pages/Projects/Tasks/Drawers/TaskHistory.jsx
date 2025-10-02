import { useState } from 'react';
import { ActionIcon, Badge, Button, Divider, Group, Loader, Modal, MultiSelect, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { IconHistory, IconRestore } from '@tabler/icons-react';
import axios from 'axios';
import { showNotification } from '@mantine/notifications';
import { usePage } from '@inertiajs/react';

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
  const { usersWithAccessToProject = [], taskGroups = [], currency } = usePage().props || {};
  const currencySymbol = currency?.symbol || '';
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
      showNotification({ color: 'red', title: 'Could not load history', message: 'Please try again in a moment.' });
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

      showNotification({
        color: 'green',
        title: 'Task restored',
        message: fields.length
          ? `Restored fields: ${fields.map((k) => allowedFieldLabels[k] || k).join(', ')}`
          : 'Restored to selected version.',
      });

      setOpen(false);
    } catch (e) {
      console.error(e);
      showNotification({ color: 'red', title: 'Restore failed', message: 'Could not restore this version.' });
    } finally {
      setRestoring(null);
    }
  };

  // Helpers to map/format field values for display in diffs
  const formatBoolean = (v) => (v ? 'Yes' : 'No');
  const formatDate = (v) => (v ? new Date(v).toLocaleString() : '—');
  const formatPricingType = (v) => {
    const s = (v ?? '').toString().toLowerCase();
    if (s === 'fixed') return 'Fixed';
    if (s === 'hourly') return 'Hourly';
    return s || '—';
    };
  const formatMoney = (v) => {
    if (v === null || v === undefined) return '—';
    const cents = parseInt(v, 10);
    if (Number.isNaN(cents)) return String(v);
    return `${currencySymbol}${(cents / 100).toFixed(2)}`;
  };
  const userNameById = (id) => {
    const found = usersWithAccessToProject.find((u) => u.id?.toString() === id?.toString());
    return found ? found.name : (id != null ? `#${id}` : '—');
  };
  const groupNameById = (id) => {
    const found = taskGroups.find((g) => g.id?.toString() === id?.toString());
    return found ? found.name : (id != null ? `#${id}` : '—');
  };
  const formatValue = (field, v) => {
    switch (field) {
      case 'description':
        return v || '';
      case 'billable':
      case 'hidden_from_clients':
        return formatBoolean(!!v);
      case 'due_on':
      case 'completed_at':
        return formatDate(v);
      case 'pricing_type':
        return formatPricingType(v);
      case 'fixed_price':
        return formatMoney(v);
      case 'assigned_to_user_id':
        return userNameById(v);
      case 'group_id':
        return groupNameById(v);
      case 'estimation':
        return v != null ? `${v} hours` : '—';
      default:
        return v != null && v !== '' ? String(v) : '—';
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
          <ScrollArea.Autosize mah={500} type="scroll">
            <Stack>
              {items.map((h) => {
                const changedKeysAll = [
                  ...Object.keys(h.old_values || {}),
                  ...Object.keys(h.new_values || {}),
                ].filter((v, i, arr) => arr.indexOf(v) === i);
                const restoreSelectable = changedKeysAll.filter((k) => Object.keys(allowedFieldLabels).includes(k));
                const restoreOptions = restoreSelectable.map((k) => ({ value: k, label: allowedFieldLabels[k] }));

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

                    {restoreSelectable.length > 0 && (
                      <MultiSelect
                        size="xs"
                        data={restoreOptions}
                        value={selectedFields[h.id] || []}
                        onChange={(vals) => onSelectFields(h.id, vals)}
                        placeholder="Restore specific fields (optional)"
                        searchable
                        clearable
                      />
                    )}

                    {/* Per-field diffs for anything that changed */}
                    <Stack gap={10} mt="xs">
                      {changedKeysAll.map((field) => {
                        const label = allowedFieldLabels[field] || field;
                        const oldVal = h.old_values?.[field];
                        const newVal = h.new_values?.[field];

                        const fmt = (f, v) => {
                          const val = formatValue(f, v);
                          if (typeof val === 'string') return val;
                          try { return JSON.stringify(val); } catch { return String(val); }
                        };

                        if (field === 'description') {
                          const hasDescOld = !!oldVal;
                          const hasDescNew = !!newVal;
                          return (
                            <div key={field}>
                              <Text size="sm" fw={600}>{label}</Text>
                              {h.event === 'created' && hasDescNew && (
                                <div dangerouslySetInnerHTML={{ __html: newVal }} />
                              )}
                              {h.event === 'updated' && (hasDescOld || hasDescNew) && (
                                <Group align="flex-start" grow wrap="nowrap">
                                  <Stack gap={4} style={{ flex: 1 }}>
                                    <Text size="xs" c="dimmed">Old</Text>
                                    <div dangerouslySetInnerHTML={{ __html: oldVal || '' }} />
                                  </Stack>
                                  <Stack gap={4} style={{ flex: 1 }}>
                                    <Text size="xs" c="dimmed">New</Text>
                                    <div dangerouslySetInnerHTML={{ __html: newVal || '' }} />
                                  </Stack>
                                </Group>
                              )}
                            </div>
                          );
                        }

                        // Generic fields
                        return (
                          <div key={field}>
                            <Text size="sm" fw={600}>{label}</Text>
                            {h.event === 'created' ? (
                              <Text>{fmt(field, newVal)}</Text>
                            ) : (
                              <Group align="flex-start" gap="xl" wrap="nowrap">
                                <Stack gap={2} style={{ minWidth: 180 }}>
                                  <Text size="xs" c="dimmed">Old</Text>
                                  <Text>{fmt(field, oldVal)}</Text>
                                </Stack>
                                <Stack gap={2} style={{ minWidth: 180 }}>
                                  <Text size="xs" c="dimmed">New</Text>
                                  <Text>{fmt(field, newVal)}</Text>
                                </Stack>
                              </Group>
                            )}
                          </div>
                        );
                      })}

                      {h.event === 'updated' && changedKeysAll.length > 0 && (
                        <Text size="xs" c="dimmed">Changed fields: {changedKeysAll.map(k => allowedFieldLabels[k] || k).join(', ')}</Text>
                      )}
                    </Stack>

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
