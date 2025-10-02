import { useState, useEffect } from 'react';
import { ActionIcon, Accordion, Badge, Button, Divider, Group, Loader, Modal, MultiSelect, ScrollArea, SegmentedControl, Stack, Text, Tooltip } from '@mantine/core';
import { IconHistory, IconRestore, IconCopy } from '@tabler/icons-react';
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
  const { usersWithAccessToProject = [], taskGroups = [], currency, labels: labelsList = [] } = usePage().props || {};
  const currencySymbol = currency?.symbol || '';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [selectedFields, setSelectedFields] = useState({}); // { [auditId]: [fields] }
  const [diffLibs, setDiffLibs] = useState({ diffWords: null, htmldiff: null });
  const [expanded, setExpanded] = useState([]); // array of opened audit IDs as strings
  const [viewMode, setViewMode] = useState({}); // { [`${auditId}:${field}`]: 'inline' | 'side' }
  const [persistedMode, setPersistedMode] = useState({}); // { [field]: 'inline'|'side' }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('taskHistory.viewModes') || '{}');
      if (saved && typeof saved === 'object') setPersistedMode(saved);
    } catch {}
  }, []);

  const savePersistedMode = (field, mode) => {
    const next = { ...persistedMode, [field]: mode };
    setPersistedMode(next);
    try { localStorage.setItem('taskHistory.viewModes', JSON.stringify(next)); } catch {}
  };

  const ensureDiffLibs = async () => {
    if (diffLibs.diffWords && diffLibs.htmldiff) return diffLibs;
    try {
      const [diffMod, htmlMod] = await Promise.all([
        import('diff'),
        import('htmldiff-js'),
      ]);
      const libs = {
        diffWords: diffMod?.diffWords || diffMod?.default?.diffWords || null,
        htmldiff: htmlMod?.default || htmlMod?.htmldiff || null,
      };
      setDiffLibs(libs);
      return libs;
    } catch (e) {
      console.warn('Diff libs failed to load, falling back to basic view.');
      return { diffWords: null, htmldiff: null };
    }
  };

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

  const onExpandChange = async (values) => {
    setExpanded(values);
    if (values.length && (!diffLibs.diffWords || !diffLibs.htmldiff)) {
      await ensureDiffLibs();
    }
  };

  const setFieldViewMode = (auditId, field, mode) => {
    setViewMode(prev => ({ ...prev, [`${auditId}:${field}`]: mode }));
    savePersistedMode(field, mode);
  };

  const getFieldViewMode = (auditId, field, defaultMode = 'inline') => viewMode[`${auditId}:${field}`] || persistedMode[field] || defaultMode;

  const copyToClipboard = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      showNotification({ color: 'green', title: 'Copied', message: `${label} copied to clipboard` });
    } catch (e) {
      showNotification({ color: 'red', title: 'Copy failed', message: 'Could not copy to clipboard' });
    }
  };

  const htmlToText = (html = '') => {
    if (typeof window === 'undefined' || !window?.document) return html;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
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
  const labelNamesByIds = (arr) => {
    const ids = Array.isArray(arr) ? arr.map((x) => (x && typeof x === 'object' ? x.id ?? x : x)) : [];
    const names = ids.map((id) => {
      const found = labelsList.find((l) => l.id?.toString() === id?.toString());
      return found ? found.name : (id != null ? `#${id}` : '—');
    });
    return names.join(', ');
  };
  const subscribersNamesByIds = (arr) => {
    const ids = Array.isArray(arr) ? arr.map((x) => (x && typeof x === 'object' ? x.id ?? x : x)) : [];
    const names = ids.map((id) => userNameById(id));
    return names.join(', ');
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
      case 'labels':
        return labelNamesByIds(v);
      case 'subscribed_users':
        return subscribersNamesByIds(v);
      default:
        return v != null && v !== '' ? String(v) : '—';
    }
  };

  const renderInlineTextDiff = (oldText = '', newText = '') => {
    if (!diffLibs.diffWords) {
      // Fallback to basic side-by-side if diff lib not loaded
      return (
        <Group align="flex-start" gap="xl" wrap="nowrap">
          <Stack gap={2} style={{ minWidth: 180 }}>
            <Text size="xs" c="dimmed">Old</Text>
            <Text>{oldText || '—'}</Text>
          </Stack>
          <Stack gap={2} style={{ minWidth: 180 }}>
            <Text size="xs" c="dimmed">New</Text>
            <Text>{newText || '—'}</Text>
          </Stack>
        </Group>
      );
    }

    const parts = diffLibs.diffWords(oldText || '', newText || '');
    return (
      <Text>
        {parts.map((p, idx) => {
          if (p.added) return <span key={idx} style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}>{p.value}</span>;
          if (p.removed) return <span key={idx} style={{ backgroundColor: 'rgba(239,68,68,0.2)', textDecoration: 'line-through' }}>{p.value}</span>;
          return <span key={idx}>{p.value}</span>;
        })}
      </Text>
    );
  };

  const renderHtmlDiff = (oldHtml = '', newHtml = '') => {
    if (diffLibs.htmldiff) {
      try {
        const diffed = diffLibs.htmldiff(oldHtml || '', newHtml || '');
        return <div dangerouslySetInnerHTML={{ __html: diffed }} />;
      } catch (e) {
        // ignore and fallback below
      }
    }
    // Fallback to side-by-side if diff lib not loaded or failed
    return (
      <Group align="flex-start" grow wrap="nowrap">
        <Stack gap={4} style={{ flex: 1 }}>
          <Text size="xs" c="dimmed">Old</Text>
          <div dangerouslySetInnerHTML={{ __html: oldHtml || '' }} />
        </Stack>
        <Stack gap={4} style={{ flex: 1 }}>
          <Text size="xs" c="dimmed">New</Text>
          <div dangerouslySetInnerHTML={{ __html: newHtml || '' }} />
        </Stack>
      </Group>
    );
  };

  const isStringField = (field, oldVal, newVal) => {
    // Consider as string diff if both values are strings and field is not explicitly formatted above
    const excluded = new Set([
      'description',
      'billable',
      'hidden_from_clients',
      'due_on',
      'completed_at',
      'pricing_type',
      'fixed_price',
      'assigned_to_user_id',
      'group_id',
      'estimation',
      'labels',
      'subscribed_users',
    ]);
    return !excluded.has(field) && typeof oldVal === 'string' && typeof newVal === 'string';
  };

  return (
    <>
      {/* Legend for diff colors */}
      <Tooltip label="View history" withArrow>
        <ActionIcon variant="light" color="gray" onClick={openHistory} aria-label="View history">
          <IconHistory size={16} />
        </ActionIcon>
      </Tooltip>

      <Modal opened={open} onClose={() => setOpen(false)} title={`Task #${task?.number} history`} size="lg">
        {/* Legend */}
        <Group gap="xs" mb="xs">
          <Text size="xs" c="dimmed">Legend:</Text>
          <Text size="xs"><span style={{ backgroundColor: 'rgba(34,197,94,0.2)', padding: '0 4px' }}>added</span></Text>
          <Text size="xs"><span style={{ backgroundColor: 'rgba(239,68,68,0.2)', textDecoration: 'line-through', padding: '0 4px' }}>removed</span></Text>
          <Text size="xs" c="dimmed">Use the view toggle on long text to switch Inline/Side-by-side.</Text>
        </Group>
        {/* Expand/Collapse all controls */}
        {items.length > 0 && (
          <Group justify="space-between" mb="xs">
            <div />
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={async () => { await ensureDiffLibs(); setExpanded(items.map(i => String(i.id))); }}>Expand all</Button>
              <Button size="xs" variant="light" color="gray" onClick={() => setExpanded([])}>Collapse all</Button>
            </Group>
          </Group>
        )}
        {/* Optional inline styles for HTML diff tags if present */}
        <style>{`.htmldiff ins{background:#dcfce7;text-decoration:none;} .htmldiff del{background:#fee2e2;}`}</style>

        {loading ? (
          <Group justify="center" my="md"><Loader size="sm" /></Group>
        ) : items.length === 0 ? (
          <Text c="dimmed">No history available.</Text>
        ) : (
          <ScrollArea.Autosize mah={500} type="scroll">
            <Accordion multiple value={expanded} onChange={onExpandChange} variant="separated" chevronPosition="left">
              {items.map((h) => {
                const changedKeysAll = [
                  ...Object.keys(h.old_values || {}),
                  ...Object.keys(h.new_values || {}),
                ].filter((v, i, arr) => arr.indexOf(v) === i);
                const restoreSelectable = changedKeysAll.filter((k) => Object.keys(allowedFieldLabels).includes(k));
                const restoreOptions = restoreSelectable.map((k) => ({ value: k, label: allowedFieldLabels[k] }));
                const itemValue = String(h.id);
                const isOpen = expanded.includes(itemValue);

                return (
                  <Accordion.Item key={h.id} value={itemValue}>
                    <Accordion.Control>
                      <Group gap="xs" justify="space-between" wrap="nowrap">
                        <Group gap="xs">
                          <Badge size="xs" variant="light" color={h.event === 'created' ? 'green' : h.event === 'updated' ? 'blue' : 'gray'}>
                            {h.event}
                          </Badge>
                          <Text size="xs" c="dimmed">{new Date(h.created_at).toLocaleString()}</Text>
                        </Group>
                        {can('edit task') && (
                          <Button size="xs" variant="light" leftSection={<IconRestore size={14} />} onClick={(e) => { e.stopPropagation(); restore(h.id); }} loading={restoring === h.id}>
                            Restore
                          </Button>
                        )}
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
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

                      {/* Only render heavy diffs when expanded */}
                      {isOpen && (
                        <Stack gap={10} mt="xs">
                          {changedKeysAll.map((field) => {
                            const label = allowedFieldLabels[field] || field;
                            const oldVal = h.old_values?.[field];
                            const newVal = h.new_values?.[field];

                            if (field === 'description') {
                              const mode = getFieldViewMode(h.id, field, 'inline');
                              const actions = (
                                <Group justify="space-between" mb={4} wrap="nowrap">
                                  <SegmentedControl size="xs" value={mode} onChange={(m) => setFieldViewMode(h.id, field, m)} data={[{ label: 'Inline', value: 'inline' }, { label: 'Side-by-side', value: 'side' }]} />
                                  <Group gap="xs">
                                    <Tooltip label="Copy Old"><ActionIcon variant="light" onClick={() => copyToClipboard('Old description', htmlToText(oldVal || ''))}><IconCopy size={14} /></ActionIcon></Tooltip>
                                    <Tooltip label="Copy New"><ActionIcon variant="light" onClick={() => copyToClipboard('New description', htmlToText(newVal || ''))}><IconCopy size={14} /></ActionIcon></Tooltip>
                                  </Group>
                                </Group>
                              );
                              if (h.event === 'created') {
                                return (
                                  <div key={field}>
                                    <Text size="sm" fw={600}>{label}</Text>
                                    {actions}
                                    {mode === 'inline' ? (
                                      <div className="htmldiff" dangerouslySetInnerHTML={{ __html: newVal || '' }} />
                                    ) : (
                                      <Group align="flex-start" grow wrap="nowrap">
                                        <Stack gap={4} style={{ flex: 1 }}>
                                          <Text size="xs" c="dimmed">Old</Text>
                                          <div dangerouslySetInnerHTML={{ __html: '' }} />
                                        </Stack>
                                        <Stack gap={4} style={{ flex: 1 }}>
                                          <Text size="xs" c="dimmed">New</Text>
                                          <div className="htmldiff" dangerouslySetInnerHTML={{ __html: newVal || '' }} />
                                        </Stack>
                                      </Group>
                                    )}
                                  </div>
                                );
                              }
                              return (
                                <div key={field}>
                                  <Text size="sm" fw={600}>{label}</Text>
                                  {actions}
                                  {mode === 'inline' ? (
                                    <div className="htmldiff">{renderHtmlDiff(oldVal || '', newVal || '')}</div>
                                  ) : (
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

                            // Inline text diff for textual fields and any other audited strings
                            const isText = isStringField(field, oldVal, newVal);
                            const isLongText = isText && ((oldVal?.length || 0) > 80 || (newVal?.length || 0) > 80);
                            if (isText) {
                              const mode = getFieldViewMode(h.id, field, isLongText ? 'inline' : 'inline');
                              const actions = (
                                <Group justify="space-between" mb={4} wrap="nowrap">
                                  {isLongText && (
                                    <SegmentedControl size="xs" value={mode} onChange={(m) => setFieldViewMode(h.id, field, m)} data={[{ label: 'Inline', value: 'inline' }, { label: 'Side-by-side', value: 'side' }]} />
                                  )}
                                  <Group gap="xs">
                                    <Tooltip label="Copy Old"><ActionIcon variant="light" onClick={() => copyToClipboard(`Old ${label}`, String(oldVal ?? ''))}><IconCopy size={14} /></ActionIcon></Tooltip>
                                    <Tooltip label="Copy New"><ActionIcon variant="light" onClick={() => copyToClipboard(`New ${label}`, String(newVal ?? ''))}><IconCopy size={14} /></ActionIcon></Tooltip>
                                  </Group>
                                </Group>
                              );
                              return (
                                <div key={field}>
                                  <Text size="sm" fw={600}>{label}</Text>
                                  {actions}
                                  {h.event === 'created' ? (
                                    mode === 'side' ? (
                                      <Group align="flex-start" gap="xl" wrap="nowrap">
                                        <Stack gap={2} style={{ minWidth: 180 }}>
                                          <Text size="xs" c="dimmed">Old</Text>
                                          <Text>—</Text>
                                        </Stack>
                                        <Stack gap={2} style={{ minWidth: 180 }}>
                                          <Text size="xs" c="dimmed">New</Text>
                                          <Text>{newVal || '—'}</Text>
                                        </Stack>
                                      </Group>
                                    ) : (
                                      <Text>{newVal || '—'}</Text>
                                    )
                                  ) : (
                                    mode === 'side' ? (
                                      <Group align="flex-start" gap="xl" wrap="nowrap">
                                        <Stack gap={2} style={{ minWidth: 180 }}>
                                          <Text size="xs" c="dimmed">Old</Text>
                                          <Text>{String(oldVal ?? '—')}</Text>
                                        </Stack>
                                        <Stack gap={2} style={{ minWidth: 180 }}>
                                          <Text size="xs" c="dimmed">New</Text>
                                          <Text>{String(newVal ?? '—')}</Text>
                                        </Stack>
                                      </Group>
                                    ) : (
                                      renderInlineTextDiff(String(oldVal ?? ''), String(newVal ?? ''))
                                    )
                                  )}
                                </div>
                              );
                            }

                            // Generic fields
                            const fmt = (f, v) => {
                              const val = formatValue(f, v);
                              if (typeof val === 'string') return val;
                              try { return JSON.stringify(val); } catch { return String(val); }
                            };
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
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          </ScrollArea.Autosize>
        )}
      </Modal>
    </>
  );
}
