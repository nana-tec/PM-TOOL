import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Anchor, Badge, Button, Divider, Group, Loader, Modal, Paper, ScrollArea, Select, Stack, Text, TextInput, Textarea, Title, Tooltip, Switch, Alert } from '@mantine/core';
import { IconBrandGithub, IconBrandGitlab, IconExternalLink, IconGitBranch, IconGitCommit, IconGitMerge, IconPlus, IconRefresh, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import axios from 'axios';
import { showNotification } from '@mantine/notifications';

const PROVIDERS = [
  { value: 'github', label: 'GitHub', icon: IconBrandGithub },
  { value: 'gitlab', label: 'GitLab', icon: IconBrandGitlab },
];

export default function VcsPanel({ projectId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState(null);

  // error banner
  const [error, setError] = useState('');

  // Form state
  const [provider, setProvider] = useState('github');
  const [repo, setRepo] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [token, setToken] = useState('');

  // Token preference and per-user token management
  const [useUserToken, setUseUserToken] = useState(true);
  const [hasUserToken, setHasUserToken] = useState(false);
  const [userToken, setUserToken] = useState('');
  const [savingUserToken, setSavingUserToken] = useState(false);

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

  // Open PR/MR modal
  const [prOpen, setPrOpen] = useState(false);
  const [prSource, setPrSource] = useState('');
  const [prTarget, setPrTarget] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [creatingPr, setCreatingPr] = useState(false);

  const providerIcon = useMemo(() => PROVIDERS.find(p => p.value === (integration?.provider || provider))?.icon, [integration, provider]);

  const notifyError = (title, message) => showNotification({ color: 'red', title, message });
  const notifySuccess = (title, message) => showNotification({ color: 'green', title, message });

  const tokenQuery = () => ({ params: { use_token: useUserToken ? 'user' : 'project' } });

  const loadIntegration = async () => {
    setLoading(true);
    setError('');
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
        setHasUserToken(integ.has_user_token || false);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      notifyError('Failed to load integration', e?.response?.data?.error || e.message);
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
    setError('');
    try {
      await axios.post(route('projects.vcs.upsert', projectId), {
        provider,
        repo,
        base_url: baseUrl || null,
        default_branch: defaultBranch || null,
        token: token || undefined,
      });
      await loadIntegration();
      setToken('');
      notifySuccess('Integration saved', 'VCS integration updated');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const removeIntegration = async () => {
    if (!integration) return;
    setSaving(true);
    setError('');
    try {
      await axios.delete(route('projects.vcs.destroy', projectId));
      setIntegration(null);
      setBranches([]);
      setCommits([]);
      setIssues([]);
      setPulls([]);
      setHasUserToken(false);
      notifySuccess('Integration removed', 'VCS integration deleted');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Remove failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const saveUserToken = async () => {
    if (!userToken?.trim()) return;
    setSavingUserToken(true);
    setError('');
    try {
      await axios.post(route('projects.vcs.user-token.set', projectId), { token: userToken });
      setHasUserToken(true);
      setUserToken('');
      notifySuccess('Token saved', 'Your personal token was saved');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to save token', msg);
    } finally {
      setSavingUserToken(false);
    }
  };

  const deleteUserToken = async () => {
    setSavingUserToken(true);
    setError('');
    try {
      await axios.delete(route('projects.vcs.user-token.delete', projectId));
      setHasUserToken(false);
      notifySuccess('Token removed', 'Your personal token was removed');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to remove token', msg);
    } finally {
      setSavingUserToken(false);
    }
  };

  const loadBranches = async () => {
    setBranchesLoading(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.branches', projectId), tokenQuery());
      const list = data.branches || [];
      setBranches(list);
      if (!selectedBranch && list.length > 0) {
        const pick = defaultBranch || list[0].name;
        setSelectedBranch(pick);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to load branches', msg);
    } finally {
      setBranchesLoading(false);
    }
  };

  const loadCommits = async (branch) => {
    if (!branch) return;
    setCommitsLoading(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.commits', projectId), { params: { ...tokenQuery().params, branch, per_page: 20 } });
      setCommits(data.commits || []);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to load commits', msg);
    } finally {
      setCommitsLoading(false);
    }
  };

  const loadIssues = async () => {
    setIssuesLoading(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.issues', projectId), tokenQuery());
      setIssues(data.issues || []);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to load issues', msg);
    } finally {
      setIssuesLoading(false);
    }
  };

  const loadPulls = async () => {
    setPullsLoading(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.pulls', projectId), tokenQuery());
      setPulls(data.pulls || []);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to load PRs/MRs', msg);
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
  }, [integration, useUserToken]);

  useEffect(() => {
    if (selectedBranch) loadCommits(selectedBranch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, useUserToken]);

  const createIssue = async () => {
    if (!issueTitle?.trim()) return;
    setCreatingIssue(true);
    setError('');
    try {
      await axios.post(route('projects.vcs.issues.create', projectId), { title: issueTitle, body: issueBody || null }, tokenQuery());
      setIssueTitle('');
      setIssueBody('');
      setIssueOpen(false);
      await loadIssues();
      notifySuccess('Issue created', 'Your issue has been created');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to create issue', msg);
    } finally {
      setCreatingIssue(false);
    }
  };

  const openPr = async () => {
    if (!prSource?.trim() || !prTarget?.trim() || !prTitle?.trim()) return;
    setCreatingPr(true);
    setError('');
    try {
      await axios.post(route('projects.vcs.pulls.open', projectId), { source_branch: prSource, target_branch: prTarget, title: prTitle, body: prBody || null }, tokenQuery());
      setPrOpen(false);
      setPrSource('');
      setPrTarget('');
      setPrTitle('');
      setPrBody('');
      await loadPulls();
      notifySuccess('Request opened', `${integration.provider === 'github' ? 'Pull request' : 'Merge request'} opened`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to open request', msg);
    } finally {
      setCreatingPr(false);
    }
  };

  const mergePull = async (number) => {
    if (!number) return;
    setError('');
    try {
      await axios.post(route('projects.vcs.merge', projectId), { number }, tokenQuery());
      await loadPulls();
      notifySuccess('Merged', 'Request merged successfully');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Merge failed', msg);
    }
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

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} mb="sm" variant="light">{error}</Alert>
      )}

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
              <TextInput label="Project access token" placeholder={integration?.has_token ? '•••••••• (leave blank to keep)' : 'Personal access token'} value={token} onChange={(e) => setToken(e.target.value)} style={{ minWidth: 240 }} />
              <Button onClick={saveIntegration} loading={saving}>Save</Button>
            </Group>
          </Paper>

          {/* Personal token */}
          {integration && (
            <Paper withBorder p="sm" radius="sm">
              <Group justify="space-between" align="flex-end" wrap="wrap">
                <Group>
                  <Switch checked={useUserToken} onChange={(e) => setUseUserToken(e.currentTarget.checked)} label="Use my personal token for API calls" />
                  <Badge color={hasUserToken ? 'green' : 'gray'} variant="light">{hasUserToken ? 'Token on file' : 'No token saved'}</Badge>
                </Group>
                <Group wrap="wrap" align="flex-end">
                  <TextInput label="My personal token" placeholder="Paste token (not shown after save)" value={userToken} onChange={(e) => setUserToken(e.target.value)} style={{ minWidth: 260 }} />
                  <Button variant="light" onClick={saveUserToken} loading={savingUserToken} disabled={!userToken?.trim()}>Save token</Button>
                  <Button variant="subtle" color="red" onClick={deleteUserToken} loading={savingUserToken} disabled={!hasUserToken}>Remove token</Button>
                </Group>
              </Group>
            </Paper>
          )}

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
                  <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => { setPrSource(selectedBranch || ''); setPrTarget(defaultBranch || 'main'); setPrTitle(''); setPrBody(''); setPrOpen(true); }}>
                    Open {integration.provider === 'github' ? 'PR' : 'MR'}
                  </Button>
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

      <Modal opened={prOpen} onClose={() => setPrOpen(false)} title={integration?.provider === 'github' ? 'Open pull request' : 'Open merge request'} size="md">
        <Stack>
          <Select label="Source branch" data={branches.map(b => ({ value: b.name, label: b.name }))} searchable value={prSource} onChange={setPrSource} placeholder="Select source branch" />
          <TextInput label="Target branch" placeholder={defaultBranch || 'main'} value={prTarget} onChange={(e) => setPrTarget(e.target.value)} />
          <TextInput label="Title" value={prTitle} onChange={(e) => setPrTitle(e.target.value)} required />
          <Textarea label="Description" value={prBody} onChange={(e) => setPrBody(e.target.value)} minRows={4} autosize />
          <Group justify="flex-end">
            <Button onClick={openPr} loading={creatingPr} disabled={!prSource?.trim() || !prTarget?.trim() || !prTitle?.trim()}>Open {integration?.provider === 'github' ? 'PR' : 'MR'}</Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
