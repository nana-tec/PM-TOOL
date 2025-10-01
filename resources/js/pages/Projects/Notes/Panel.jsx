import { useEffect, useState } from 'react';
import { Box, Button, Group, Loader, Paper, Stack, Text, Textarea, Title, ActionIcon, Pagination } from '@mantine/core';
import { IconPencil, IconTrash, IconX, IconCheck } from '@tabler/icons-react';
import axios from 'axios';

export default function NotesPanel({ projectId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [can, setCan] = useState({ create: false, edit: false, delete: false });
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 10, total: 0 });

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
    if (!newContent || newContent.length < 8) return;
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
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (noteId) => {
    if (!editContent || editContent.length < 8) return;
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

  const onPageChange = async (page) => {
    await fetchNotes(page);
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="sm">
        <Title order={3}>Project notes</Title>
      </Group>

      {can.create && (
        <Stack gap="sm">
          <Textarea
            placeholder="Write a note (min 8 characters)"
            autosize
            minRows={2}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <Group justify="flex-end">
            <Button loading={saving} onClick={addNote} disabled={!newContent || newContent.length < 8}>
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
                      <Textarea autosize minRows={2} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                      <Group justify="flex-end">
                        <ActionIcon color="gray" variant="light" onClick={cancelEdit}><IconX size={16} /></ActionIcon>
                        <ActionIcon color="green" variant="light" onClick={() => saveEdit(note.id)} disabled={!editContent || editContent.length < 8}>
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
                        <Text>{note.content}</Text>
                      </Stack>
                      <Group gap={6}>
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
    </Paper>
  );
}
