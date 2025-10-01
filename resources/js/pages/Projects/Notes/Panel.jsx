import { useEffect, useState } from 'react';
import { Box, Button, Group, Loader, Modal, Paper, ScrollArea, Stack, Text, Title, ActionIcon, Pagination, Divider, Badge } from '@mantine/core';
import { IconPencil, IconTrash, IconX, IconCheck, IconHistory } from '@tabler/icons-react';
import axios from 'axios';
import RichTextEditor from '@/components/RichTextEditor';

function stripHtml(html = '') {
  const tmp = typeof window !== 'undefined' ? document.createElement('div') : null;
  if (!tmp) return html;
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

export default function NotesPanel({ projectId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [can, setCan] = useState({ create: false, edit: false, delete: false });
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 10, total: 0 });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNoteId, setHistoryNoteId] = useState(null);
  const [restoringAuditId, setRestoringAuditId] = useState(null);

  const fetchNotes = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await axios.get(route('projects.notes', projectId), { params: { page, per_page: meta.per_page } });
      setNotes(data.notes);
      setMeta(data.meta);
      setCan(data.can);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const addNote = async () => {
    const plain = stripHtml(newContent);
    if (!plain || plain.length < 8) return;
    setSaving(true);
    try {
      const { data } = await axios.post(route('projects.notes.store', projectId), { content: newContent });
      // Prepend new note and increment total; if page is not first, reload first page
      if (meta.current_page === 1) {
        setNotes((prev) => [data.note, ...prev]);
      }
      setNewContent('');
      // Optionally refetch to maintain pagination integrity
      await fetchNotes(meta.current_page);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditContent(note.content || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (noteId) => {
    const plain = stripHtml(editContent);
    if (!plain || plain.length < 8) return;
    setSaving(true);
    try {
      const { data } = await axios.put(route('projects.notes.update', [projectId, noteId]), { content: editContent });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? data.note : n)));
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (noteId) => {
    setSaving(true);
    try {
      await axios.delete(route('projects.notes.destroy', [projectId, noteId]));
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      // Optionally refetch to keep pages full
      await fetchNotes(meta.current_page);
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (noteId) => {
    setHistoryNoteId(noteId);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const { data } = await axios.get(route('projects.notes.history', [projectId, noteId]));
      setHistoryItems(data.history || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  const restoreFromHistory = async (auditId) => {
    if (!historyNoteId) return;
    setRestoringAuditId(auditId);
    try {
      const { data } = await axios.post(route('projects.notes.history.restore', [projectId, historyNoteId, auditId]));
      const updated = data.note;
      setNotes(prev => prev.map(n => (n.id === updated.id ? updated : n)));
    } finally {
      setRestoringAuditId(null);
    }
  };

  const onPageChange = async (page) => {
    await fetchNotes(page);
  };

  const canSubmitNew = stripHtml(newContent).length >= 8;
  const canSubmitEdit = stripHtml(editContent).length >= 8;

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="sm">
        <Title order={3}>Project notes</Title>
      </Group>

      {can.create && (
        <Stack gap="sm">
          <RichTextEditor
            placeholder="Write a note (min 8 characters)"
            content={newContent}
            onChange={setNewContent}
            height={150}
          />
          <Group justify="flex-end">
            <Button loading={saving} onClick={addNote} disabled={!canSubmitNew}>
              Add note
            </Button>
          </Group>
        </Stack>
      )}

      <Box mt="lg">
        {loading ? (
          <Group justify="center" my="md">
            <Loader size="sm" />
          </Group>
        ) : notes.length === 0 ? (
          <Text c="dimmed">No notes yet.</Text>
        ) : (
          <>
            <Stack>
              {notes.map((note) => (
                <Paper key={note.id} withBorder p="sm" radius="sm">
                  {editingId === note.id ? (
                    <Stack>
                      <RichTextEditor
                        key={editingId}
                        placeholder="Edit note"
                        content={editContent}
                        onChange={setEditContent}
                        height={150}
                      />
                      <Group justify="flex-end">
                        <ActionIcon color="gray" variant="light" onClick={cancelEdit}><IconX size={16} /></ActionIcon>
                        <ActionIcon color="green" variant="light" onClick={() => saveEdit(note.id)} disabled={!canSubmitEdit}>
                          <IconCheck size={16} />
                        </ActionIcon>
                      </Group>
                    </Stack>
                  ) : (
                    <Group align="flex-start" justify="space-between" wrap="nowrap">
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Group gap="xs">
                          {note.user && (
                            <Text fw={600}>{note.user.name}</Text>
                          )}
                          <Text size="xs" c="dimmed">{new Date(note.created_at).toLocaleString()}</Text>
                        </Group>
                        <div dangerouslySetInnerHTML={{ __html: note.content }} />
                      </Stack>
                      <Group gap={6}>
                        <ActionIcon variant="subtle" color="gray" onClick={() => openHistory(note.id)} title="View history"><IconHistory size={16} /></ActionIcon>
                        {can.edit && (
                          <ActionIcon variant="subtle" color="blue" onClick={() => startEdit(note)}><IconPencil size={16} /></ActionIcon>
                        )}
                        {can.delete && (
                          <ActionIcon variant="subtle" color="red" onClick={() => deleteNote(note.id)}><IconTrash size={16} /></ActionIcon>
                        )}
                      </Group>
                    </Group>
                  )}
                </Paper>
              ))}
            </Stack>
            {meta.last_page > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={meta.last_page} value={meta.current_page} onChange={onPageChange} />
              </Group>
            )}
          </>
        )}
      </Box>

      <Modal opened={historyOpen} onClose={() => setHistoryOpen(false)} title="Note history" size="lg">
        {historyLoading ? (
          <Group justify="center" my="md"><Loader size="sm" /></Group>
        ) : historyItems.length === 0 ? (
          <Text c="dimmed">No history available.</Text>
        ) : (
          <ScrollArea.Autosize mah={400} type="scroll">
            <Stack>
              {historyItems.map((h) => (
                <div key={h.id}>
                  <Group gap="xs" mb={6} justify="space-between" wrap="nowrap">
                    <Group gap="xs">
                      <Badge size="xs" variant="light" color={h.event === 'created' ? 'green' : h.event === 'updated' ? 'blue' : 'gray'}>
                        {h.event}
                      </Badge>
                      <Text size="xs" c="dimmed">{new Date(h.created_at).toLocaleString()}</Text>
                    </Group>
                    {can.edit && (
                      <Button size="xs" variant="light" onClick={() => restoreFromHistory(h.id)} loading={restoringAuditId === h.id}>
                        Restore this version
                      </Button>
                    )}
                  </Group>
                  {h.event === 'created' && h.new_values?.content && (
                    <div dangerouslySetInnerHTML={{ __html: h.new_values.content }} />
                  )}
                  {h.event === 'updated' && (
                    <Group align="flex-start" grow wrap="nowrap">
                      <Stack gap={4}>
                        <Text size="sm" fw={600}>Old</Text>
                        <div dangerouslySetInnerHTML={{ __html: h.old_values?.content || '' }} />
                      </Stack>
                      <Stack gap={4}>
                        <Text size="sm" fw={600}>New</Text>
                        <div dangerouslySetInnerHTML={{ __html: h.new_values?.content || '' }} />
                      </Stack>
                    </Group>
                  )}
                  <Divider my="sm" />
                </div>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Modal>
    </Paper>
  );
}
