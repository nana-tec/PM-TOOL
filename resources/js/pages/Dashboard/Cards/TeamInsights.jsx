import { useEffect, useState, useMemo } from 'react';
import { Card, Group, Loader, Stack, Text, Title, Badge, Anchor, Divider, ScrollArea, Button } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconExternalLink, IconUser } from '@tabler/icons-react';
import axios from 'axios';

export default function TeamInsightsCard() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(route('reports.team-metrics.json'), { params: { limit: 30 } });
        if (!mounted) return;
        setItems(data.items || []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const risks = useMemo(() => [...items].filter(i => (i.risk_score ?? 0) > 0).sort((a,b)=> (b.risk_score||0)-(a.risk_score||0)).slice(0,5), [items]);
  const freeNow = useMemo(() => [...items].sort((a,b)=> (b.availability_hours||0)-(a.availability_hours||0)).slice(0,5), [items]);

  const Row = ({ icon, left, right, color = 'gray' }) => (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Group gap={6} wrap="nowrap">
        {icon}
        <Text size="sm" fw={600} lineClamp={1} style={{ maxWidth: 180 }}>{left}</Text>
      </Group>
      <Badge size="xs" color={color} variant="light">{right}</Badge>
    </Group>
  );

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="center" mb="xs">
        <Title order={5}>Team insights</Title>
        <Anchor href={route('reports.team-metrics')} onClick={(e) => { e.preventDefault(); window.location.href = route('reports.team-metrics'); }}>
          Open report <IconExternalLink size={14} style={{ verticalAlign:'middle' }} />
        </Anchor>
      </Group>
      {loading ? (
        <Group justify="center" my="md"><Loader size="xs" /></Group>
      ) : (
        <Stack gap="xs">
          <Text size="sm" fw={600}>Top risks</Text>
          <ScrollArea.Autosize mah={120} type="always" scrollbarSize={8}>
            <Stack gap={6}>
              {risks.length === 0 && <Text size="sm" c="dimmed">No risks detected.</Text>}
              {risks.map((m) => (
                <Row key={m.user.id} icon={<IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />} left={m.user.name} right={`${(m.risk_score??0).toFixed(1)}`} color={m.risk_score>=70?'red':m.risk_score>=40?'orange':'green'} />
              ))}
            </Stack>
          </ScrollArea.Autosize>

          <Divider my={8} />

          <Text size="sm" fw={600}>Available now</Text>
          <ScrollArea.Autosize mah={120} type="always" scrollbarSize={8}>
            <Stack gap={6}>
              {freeNow.length === 0 && <Text size="sm" c="dimmed">No availability data.</Text>}
              {freeNow.map((m) => (
                <Row key={m.user.id} icon={<IconUser size={14} />} left={m.user.name} right={`${(m.availability_hours||0).toFixed(1)}h`} color="teal" />
              ))}
            </Stack>
          </ScrollArea.Autosize>

          <Group justify="flex-end" mt="xs">
            <Button size="xs" variant="light" onClick={() => { window.location.href = route('reports.team-metrics'); }}>Go to Team metrics</Button>
          </Group>
        </Stack>
      )}
    </Card>
  );
}

