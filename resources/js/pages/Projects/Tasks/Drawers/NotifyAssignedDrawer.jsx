import { usePage } from '@inertiajs/react';
import { Button, Drawer, Flex, MultiSelect, Text, rem } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useState } from 'react';
import { router } from '@inertiajs/react';

export function NotifyAssignedDrawer({ task, opened, onClose }) {
  const { usersWithAccessToProject } = usePage().props;
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = () => {
    if (!selectedUsers.length) return;

    setProcessing(true);
    router.post(
      route('projects.tasks.notify-assigned', [task.project_id, task.id]),
      { user_ids: selectedUsers },
      {
        onSuccess: () => {
          setSelectedUsers([]);
          setProcessing(false);
          onClose();
        },
        onError: () => {
          setProcessing(false);
        },
      }
    );
  };

  const handleClose = () => {
    setSelectedUsers([]);
    onClose();
  };

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={
        <Text
          fz={rem(24)}
          fw={600}
          ml={25}
          my='sm'
        >
          Notify users about task #{task.number}
        </Text>
      }
      position='right'
      size={500}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      transitionProps={{
        transition: 'slide-left',
        duration: 400,
        timingFunction: 'ease',
      }}
    >
      <div style={{ padding: '0 25px' }}>
        <MultiSelect
          label='Select users to notify'
          placeholder='Choose users who will receive a notification'
          searchable
          value={selectedUsers}
          onChange={setSelectedUsers}
          data={usersWithAccessToProject.map(i => ({
            value: i.id.toString(),
            label: i.name,
          }))}
        />

        <Flex
          justify='space-between'
          mt='xl'
        >
          <Button
            variant='transparent'
            w={100}
            onClick={handleClose}
          >
            Cancel
          </Button>

          <Button
            leftSection={<IconBell size={16} />}
            w={140}
            loading={processing}
            disabled={!selectedUsers.length}
            onClick={handleSubmit}
          >
            Notify
          </Button>
        </Flex>
      </div>
    </Drawer>
  );
}
