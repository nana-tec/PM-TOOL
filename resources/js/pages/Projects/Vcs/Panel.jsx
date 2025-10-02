import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Anchor, Badge, Button, Divider, Group, Loader, Modal, Paper, ScrollArea, Select, Stack, Text, TextInput, Textarea, Title, Tooltip } from '@mantine/core';
import { IconBrandGithub, IconBrandGitlab, IconExternalLink, IconGitBranch, IconGitCommit, IconGitMerge, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import axios from 'axios';

const PROVIDERS = [
  { value: 'github', label: 'GitHub', icon: IconBrandGithub },
  { value: 'gitlab', label: 'GitLab', icon: IconBrandGitlab },
];

export default function VcsPanel({ projectId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState(null);

  // Form state
  const [provider, setProvider] = useState('github');
  const [repo, setRepo] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [token, setToken] = useState('');

  // Data
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [commits, setCommits] = useState([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [pulls, setPulls] = useState([]);
  const [pullsLoading, setPullsLoading] = useState(false);

  // Create issue modal
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueBody, setIssueBody] = useState('');
  const [creatingIssue, setCreatingIssue] = useState(false);

  const providerIcon = useMemo(() => PROVIDERS.find(p => p.value === (integration?.provider || provider))?.icon, [integration, provider]);

  const loadIntegration = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(route('projects.vcs.show', projectId));
      const integ = data.integration;
      setIntegration(integ);
      if (integ) {
        setProvider(integ.provider);
        setRepo(integ.repo || '');
        setBaseUrl(integ.base_url || '');
        setDefaultBranch(integ.default_branch || '');
        setSelectedBranch(integ.default_branch || '');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) loadIntegration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const saveIntegration = async () => {
    setSaving(true);
    try {
      await axios.post(route('projects.vcs.upsert', projectId), {
        provider,
        repo,
        base_url: baseUrl || null,
        default_branch: defaultBranch || null,
        token: token || undefined,
      });
      await loadIntegration();
      // clear token input after save
      setToken('');
    } finally {
      setSaving(false);
    }
  };

  const removeIntegration = async () => {
    if (!integration) return;
    setSaving(true);
    try {
      await axios.delete(route('projects.vcs.destroy', projectId));
      setIntegration(null);
      setBranches([]);
      setCommits([]);
      setIssues([]);
      setPulls([]);
    } finally {
      setSaving(false);
    }
  };

  const loadBranches = async () => {
    setBranchesLoading(true);
    try {
      const { data } = await axios.get(route('projects.vcs.branches', projectId));
      const list = data.branches || [];
      setBranches(list);
      if (!selectedBranch && list.length > 0) {
        const pick = defaultBranch || list[0].name;
        setSelectedBranch(pick);
      }
    } finally {
      setBranchesLoading(false);
    }
  };

  const loadCommits = async (branch) => {
    if (!branch) return;
    setCommitsLoading(true);
    try {
      const { data } = await axios.get(route('projects.vcs.commits', projectId), { params: { branch, per_page: 20 } });
      setCommits(data.commits || []);
    } finally {
      setCommitsLoading(false);
    }
  };

  const loadIssues = async () => {
    setIssuesLoading(true);
    try {
      const { data } = await axios.get(route('projects.vcs.issues', projectId));
      setIssues(data.issues || []);
    } finally {
      setIssuesLoading(false);
    }
  };

  const loadPulls = async () => {
    setPullsLoading(true);
    try {
      const { data } = await axios.get(route('projects.vcs.pulls', projectId));
      setPulls(data.pulls || []);
    } finally {
      setPullsLoading(false);
    }
  };

  useEffect(() => {
    if (integration) {
      loadBranches();
      loadIssues();
      loadPulls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration]);

  useEffect(() => {
    if (selectedBranch) loadCommits(selectedBranch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  const createIssue = async () => {
    if (!issueTitle?.trim()) return;
    setCreatingIssue(true);
    try {
      const { data } = await axios.post(route('projects.vcs.issues.create', projectId), { title: issueTitle, body: issueBody || null });
      setIssueTitle('');
      setIssueBody('');
      setIssueOpen(false);
      await loadIssues();
      return data.issue;
    } finally {
      setCreatingIssue(false);
    }
  };

  const mergePull = async (number) => {
    if (!number) return;
    await axios.post(route('projects.vcs.merge', projectId), { number });
    await loadPulls();
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="sm">
        <Title order={3}>Version control</Title>
        {integration && (
          <Group gap="xs">
            <Badge color="teal" variant="light">{integration.provider}</Badge>
            <Tooltip label="Remove integration">
              <ActionIcon color="red" variant="subtle" onClick={removeIntegration} loading={saving}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>

      {loading ? (
        <Group justify="center" my="md"><Loader size="sm" /></Group>
      ) : (
        <Stack gap="md">
          {/* Configure */}
          <Paper withBorder p="sm" radius="sm">
            <Group gap="md" wrap="wrap" align="flex-end">
              <div style={{ minWidth: 220 }}>
                <Select label="Provider" data={PROVIDERS} value={provider} onChange={setProvider} />
              </div>
              <TextInput
                label={provider === 'github' ? 'Repository (owner/name)' : 'Project path (group/name)'}
                placeholder={provider === 'github' ? 'acme/my-repo' : 'group/subgroup/project'}
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                style={{ minWidth: 260 }}
              />
              {provider === 'gitlab' && (
                <TextInput
                  label="Base URL (self-hosted)"
                  placeholder="https://gitlab.example.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  style={{ minWidth: 260 }}
                />
              )}
              <TextInput label="Default branch" placeholder="main" value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} style={{ minWidth: 160 }} />
              <TextInput label="Access token" placeholder={integration?.has_token ? '•••••••• (leave blank to keep)' : 'Personal access token'} value={token} onChange={(e) => setToken(e.target.value)} style={{ minWidth: 240 }} />
              <Button onClick={saveIntegration} loading={saving}>Save</Button>
            </Group>
          </Paper>

          {!integration ? (
            <Text c="dimmed">Connect this project to GitHub or GitLab to view branches/commits, create issues and open merge requests.</Text>
          ) : (
            <Stack gap="md">
              <Group justify="space-between">
                <Group gap="xs">
                  {providerIcon && (providerIcon ? <providerIcon size={18} /> : null)}
                  <Text fw={600}>{integration.repo}</Text>
                  <Anchor href="#" onClick={(e) => { e.preventDefault(); window.open((integration.provider === 'github' ? `https://github.com/${integration.repo}` : `${integration.base_url || 'https://gitlab.com'}/${integration.repo}`), '_blank'); }}>
                    Open repo <IconExternalLink size={14} style={{ verticalAlign: 'middle' }} />
                  </Anchor>
                </Group>
                <Group gap="xs">
                  <Tooltip label="Reload data">
                    <ActionIcon variant="subtle" onClick={() => { loadBranches(); loadIssues(); loadPulls(); if (selectedBranch) loadCommits(selectedBranch); }}>
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <Group align="flex-start" grow>
                {/* Branches & commits */}
                <Paper withBorder p="sm" radius="sm">
                  <Group gap="sm">
                    <IconGitBranch size={16} />
                    <Text fw={600}>Branches</Text>
                  </Group>
                  <Group mt="sm" gap="sm" align="flex-end">
                    <Select
                      placeholder="Select branch"
                      data={branches.map(b => ({ value: b.name, label: b.name }))}
                      value={selectedBranch}
                      onChange={setSelectedBranch}
                      searchable
                      nothingFound={branchesLoading ? 'Loading...' : 'No branches'}
                      style={{ minWidth: 220 }}
                    />
                    <ActionIcon variant="subtle" onClick={loadBranches} loading={branchesLoading}><IconRefresh size={16} /></ActionIcon>
                  </Group>
                  <Divider my="xs" />
                  <ScrollArea.Autosize mah={240} type="scroll">
                    {commitsLoading ? (
                      <Group justify="center" my="sm"><Loader size="xs" /></Group>
                    ) : commits.length === 0 ? (
                      <Text c="dimmed">No commits.</Text>
                    ) : (
                      <Stack gap={8}>
                        {commits.map((c) => (
                          <Group key={c.sha} gap="xs" align="flex-start" wrap="nowrap">
                            <IconGitCommit size={14} />
                            <Stack gap={2} style={{ flex: 1 }}>
                              <Text size="sm" fw={600} lineClamp={2}>{c.message}</Text>
                              <Text size="xs" c="dimmed">{c.sha.substring(0, 7)} · {c.author || 'Unknown'} · {c.date ? new Date(c.date).toLocaleString() : ''}</Text>
                            </Stack>
                            {c.url && (
                              <Anchor href={c.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>
                            )}
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </ScrollArea.Autosize>
                </Paper>

                {/* Issues */}
                <Paper withBorder p="sm" radius="sm">
                  <Group gap="sm" justify="space-between">
                    <Group gap="sm">
                      <IconPlus size={16} />
                      <Text fw={600}>Issues</Text>
                    </Group>
                    <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setIssueOpen(true)}>New issue</Button>
                  </Group>
                  <Divider my="xs" />
                  <ScrollArea.Autosize mah={240} type="scroll">
                    {issuesLoading ? (
                      <Group justify="center" my="sm"><Loader size="xs" /></Group>
                    ) : issues.length === 0 ? (
                      <Text c="dimmed">No open issues.</Text>
                    ) : (
                      <Stack gap={8}>
                        {issues.map((i) => (
                          <Group key={i.id} gap="xs" wrap="nowrap" justify="space-between">
                            <Stack gap={2} style={{ flex: 1 }}>
                              <Text size="sm" fw={600}>{i.title}</Text>
                              <Group gap={6}><Badge size="xs" variant="light" color={i.state === 'open' || i.state === 'opened' ? 'green' : 'gray'}>{i.state}</Badge>{i.url && (<Anchor href={i.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>)}</Group>
                            </Stack>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </ScrollArea.Autosize>
                </Paper>

                {/* Pull Requests / Merge Requests */}
                <Paper withBorder p="sm" radius="sm">
                  <Group gap="sm">
                    <IconGitMerge size={16} />
                    <Text fw={600}>{integration.provider === 'github' ? 'Pull requests' : 'Merge requests'}</Text>
                  </Group>
                  <Divider my="xs" />
                  <ScrollArea.Autosize mah={240} type="scroll">
                    {pullsLoading ? (
                      <Group justify="center" my="sm"><Loader size="xs" /></Group>
                    ) : pulls.length === 0 ? (
                      <Text c="dimmed">No open {integration.provider === 'github' ? 'PRs' : 'MRs'}.</Text>
                    ) : (
                      <Stack gap={8}>
                        {pulls.map((p) => (
                          <Group key={p.number} gap="xs" wrap="nowrap" justify="space-between" align="center">
                            <Stack gap={2} style={{ flex: 1 }}>
                              <Text size="sm" fw={600}>{p.title}</Text>
                              <Group gap={6}><Badge size="xs" variant="light" color={p.state === 'open' || p.state === 'opened' ? 'green' : 'gray'}>{p.state}</Badge>{p.url && (<Anchor href={p.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>)}</Group>
                            </Stack>
                            <Tooltip label="Merge">
                              <ActionIcon variant="light" color="green" onClick={() => mergePull(p.number)}><IconGitMerge size={16} /></ActionIcon>
                            </Tooltip>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </ScrollArea.Autosize>
                </Paper>
              </Group>
            </Stack>
          )}
        </Stack>
      )}

      <Modal opened={issueOpen} onClose={() => setIssueOpen(false)} title="Create issue" size="md">
        <Stack>
          <TextInput label="Title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} required />
          <Textarea label="Description" value={issueBody} onChange={(e) => setIssueBody(e.target.value)} minRows={4} autosize />
          <Group justify="flex-end">
            <Button onClick={createIssue} loading={creatingIssue} disabled={!issueTitle?.trim()}>Create</Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
