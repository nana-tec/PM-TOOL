import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Anchor, Alert, Badge, Button, Divider, Group, Loader, Modal, Paper, ScrollArea, Select, Stack, Text, TextInput, Textarea, Title, Tooltip, Switch, MultiSelect } from '@mantine/core';
import { IconBrandGithub, IconBrandGitlab, IconExternalLink, IconGitBranch, IconGitCommit, IconGitMerge, IconPlus, IconRefresh, IconTrash, IconAlertCircle, IconInfoCircle, IconDownload } from '@tabler/icons-react';
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

  // Data + pagination
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesPage, setBranchesPage] = useState(1);
  const [branchesHasNext, setBranchesHasNext] = useState(false);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [commits, setCommits] = useState([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsPage, setCommitsPage] = useState(1);
  const [commitsHasNext, setCommitsHasNext] = useState(false);

  const [issuesState, setIssuesState] = useState('open');
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesPage, setIssuesPage] = useState(1);
  const [issuesHasNext, setIssuesHasNext] = useState(false);

  const [pullsState, setPullsState] = useState('open'); // open|closed|merged
  const [pulls, setPulls] = useState([]);
  const [pullsLoading, setPullsLoading] = useState(false);
  const [pullsPage, setPullsPage] = useState(1);
  const [pullsHasNext, setPullsHasNext] = useState(false);

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

  // PR details modal
  const [prDetailsOpen, setPrDetailsOpen] = useState(false);
  const [prDetails, setPrDetails] = useState(null);
  const [prComments, setPrComments] = useState([]);
  const [prCommentsPage, setPrCommentsPage] = useState(1);
  const [prCommentsHasNext, setPrCommentsHasNext] = useState(false);
  const [loadingPrDetails, setLoadingPrDetails] = useState(false);
  const [loadingPrComments, setLoadingPrComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Compare modal
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBase, setCompareBase] = useState('');
  const [compareHead, setCompareHead] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareCommits, setCompareCommits] = useState([]);
  const [compareFiles, setCompareFiles] = useState([]);

  // PR statuses
  const [prStatuses, setPrStatuses] = useState([]);
  const [prStatusSha, setPrStatusSha] = useState('');
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [requiredChecks, setRequiredChecks] = useState([]);

  // Reviewers picker
  const [reviewers, setReviewers] = useState([]); // [{username, name}]
  const [reviewersPage, setReviewersPage] = useState(1);
  const [reviewersHasNext, setReviewersHasNext] = useState(false);
  const [loadingReviewers, setLoadingReviewers] = useState(false);
  const [selectedReviewerUsernames, setSelectedReviewerUsernames] = useState([]);
  const [addingReviewers, setAddingReviewers] = useState(false);

  // Issue details/comments
  const [issueDetailsOpen, setIssueDetailsOpen] = useState(false);
  const [issueDetails, setIssueDetails] = useState(null); // {id,title,state,url}
  const [issueComments, setIssueComments] = useState([]);
  const [issueCommentsPage, setIssueCommentsPage] = useState(1);
  const [issueCommentsHasNext, setIssueCommentsHasNext] = useState(false);
  const [loadingIssueComments, setLoadingIssueComments] = useState(false);
  const [newIssueComment, setNewIssueComment] = useState('');
  const [submittingIssueComment, setSubmittingIssueComment] = useState(false);

  const providerIcon = useMemo(() => PROVIDERS.find(p => p.value === (integration?.provider || provider))?.icon, [integration, provider]);

  const notifyError = (title, message) => showNotification({ color: 'red', title, message });
  const notifySuccess = (title, message) => showNotification({ color: 'green', title, message });

  const tokenParams = () => ({ use_token: useUserToken ? 'user' : 'project' });

  // Friendly error parser for common VCS errors
  const parseApiError = (e, fallback = 'Something went wrong') => {
    try {
      const status = e?.response?.status;
      const headers = e?.response?.headers || {};
      const data = e?.response?.data || {};
      const msg = data?.error || data?.message || e?.message || fallback;
      // Rate limit hint
      if (status === 403 && (headers['x-ratelimit-remaining'] === '0' || /rate limit/i.test(msg))) {
        return 'API rate limit exceeded. Try again later or switch token in the panel.';
      }
      // GitHub PR base invalid
      const errors = data?.errors;
      if (Array.isArray(errors)) {
        const baseInvalid = errors.find(er => er?.resource === 'PullRequest' && er?.field === 'base' && er?.code === 'invalid');
        if (baseInvalid) return 'Invalid target branch. Ensure the target/base branch exists and you have access.';
      }
      // GitHub merge weird schema error
      if (status === 422 && /links\/1\/schema/.test(String(msg))) {
        return 'Merge cannot be completed via API. Ensure the PR is mergeable, up to date, and you have permissions.';
      }
      if (status === 401) return 'Unauthorized. Check your token.';
      if (status === 404) return 'Not found. Check repository and permissions.';
      return msg;
    } catch {
      return fallback;
    }
  };

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

  // Branches
  const fetchBranches = async (page = 1) => {
    setBranchesLoading(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.branches', projectId), { params: { ...tokenParams(), page, per_page: 30 } });
      setBranches(prev => (page === 1 ? data.branches : [...prev, ...data.branches]));
      setBranchesHasNext(!!data.has_next);
      setBranchesPage(page);
      if (!selectedBranch && (data.branches?.length ?? 0) > 0) {
        const pick = defaultBranch || data.branches[0].name;
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

  // Commits
  const fetchCommits = async (branch, page = 1) => {
    if (!branch) return;
    setCommitsLoading(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.commits', projectId), { params: { ...tokenParams(), branch, page, per_page: 20 } });
      setCommits(prev => (page === 1 ? data.commits : [...prev, ...data.commits]));
      setCommitsHasNext(!!data.has_next);
      setCommitsPage(page);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to load commits', msg);
    } finally {
      setCommitsLoading(false);
    }
  };

  // Issues
  const fetchIssues = async (state = issuesState, page = 1) => {
    setIssuesLoading(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.issues', projectId), { params: { ...tokenParams(), state, page, per_page: 20 } });
      setIssues(prev => (page === 1 ? data.issues : [...prev, ...data.issues]));
      setIssuesHasNext(!!data.has_next);
      setIssuesPage(page);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to load issues', msg);
    } finally {
      setIssuesLoading(false);
    }
  };

  // Pulls
  const fetchPulls = async (state = pullsState, page = 1) => {
    setPullsLoading(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.pulls', projectId), { params: { ...tokenParams(), state, page, per_page: 20 } });
      setPulls(prev => (page === 1 ? data.pulls : [...prev, ...data.pulls]));
      setPullsHasNext(!!data.has_next);
      setPullsPage(page);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      notifyError('Failed to load PRs/MRs', msg);
    } finally {
      setPullsLoading(false);
    }
  };

  // Load after integration or token switch
  useEffect(() => {
    if (integration) {
      fetchBranches(1);
      fetchIssues('open', 1);
      fetchPulls('open', 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration, useUserToken]);

  // Reload commits when branch changes
  useEffect(() => {
    if (selectedBranch) {
      fetchCommits(selectedBranch, 1);
    } else {
      setCommits([]);
      setCommitsHasNext(false);
      setCommitsPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, useUserToken]);

  const createIssue = async () => {
    if (!issueTitle?.trim()) return;
    setCreatingIssue(true);
    setError('');
    try {
      await axios.post(route('projects.vcs.issues.create', projectId), { title: issueTitle, body: issueBody || null }, { params: tokenParams() });
      setIssueTitle('');
      setIssueBody('');
      setIssueOpen(false);
      await fetchIssues(issuesState, 1);
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
      await axios.post(route('projects.vcs.pulls.open', projectId), { source_branch: prSource, target_branch: prTarget, title: prTitle, body: prBody || null }, { params: tokenParams() });
      setPrOpen(false);
      setPrSource('');
      setPrTarget('');
      setPrTitle('');
      setPrBody('');
      await fetchPulls(pullsState, 1);
      notifySuccess('Request opened', `${integration.provider === 'github' ? 'Pull request' : 'Merge request'} opened`);
    } catch (e) {
      const msg = parseApiError(e, 'Failed to open request');
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
      await axios.post(route('projects.vcs.merge', projectId), { number }, { params: tokenParams() });
      await fetchPulls(pullsState, 1);
      notifySuccess('Merged', 'Request merged successfully');
    } catch (e) {
      const msg = parseApiError(e, 'Merge failed');
      setError(msg);
      notifyError('Merge failed', msg);
    }
  };

  // PR details
  const openPrDetails = async (number) => {
    setPrDetailsOpen(true);
    setLoadingPrDetails(true);
    setPrDetails(null);
    setPrComments([]);
    setPrCommentsPage(1);
    setPrCommentsHasNext(false);
    setReviewers([]);
    setSelectedReviewerUsernames([]);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.pulls.details', [projectId, number]), { params: tokenParams() });
      setPrDetails(data.pull);
      await Promise.all([
        fetchPrStatuses(number),
        fetchRequiredChecks(number),
        fetchPrComments(number, 1),
        fetchReviewers(number, 1),
      ]);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to load PR details', message: msg });
    } finally {
      setLoadingPrDetails(false);
    }
  };

  // Status checks
  const fetchPrStatuses = async (number) => {
    if (!number) return;
    setLoadingStatuses(true);
    try {
      const { data } = await axios.get(route('projects.vcs.pulls.statuses', [projectId, number]), { params: tokenParams() });
      setPrStatusSha(data.sha || '');
      setPrStatuses(data.statuses || []);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to fetch statuses', message: msg });
    } finally {
      setLoadingStatuses(false);
    }
  };

  const fetchRequiredChecks = async (number) => {
    if (!number) return;
    try {
      const { data } = await axios.get(route('projects.vcs.pulls.required-checks', [projectId, number]), { params: tokenParams() });
      setRequiredChecks(data.required || []);
    } catch (e) {
      // non-fatal; ignore silently
    }
  };

  // Lightweight PR details refresh (without comments/reviewers)
  const refreshPrDetailsOnly = async (number) => {
    if (!number) return;
    try {
      const { data } = await axios.get(route('projects.vcs.pulls.details', [projectId, number]), { params: tokenParams() });
      setPrDetails(data.pull);
    } catch (_) {
      // ignore transient errors during polling
    }
  };

  // Reviewers
  const fetchReviewers = async (number, page = 1) => {
    setLoadingReviewers(true);
    try {
      const { data } = await axios.get(route('projects.vcs.pulls.reviewers', [projectId, number]), { params: { ...tokenParams(), page, per_page: 50 } });
      setReviewers(prev => (page === 1 ? data.reviewers : [...prev, ...data.reviewers]));
      setReviewersHasNext(!!data.has_next);
      setReviewersPage(page);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to load reviewers', message: msg });
    } finally {
      setLoadingReviewers(false);
    }
  };

  const addSelectedReviewers = async () => {
    if (!prDetails || selectedReviewerUsernames.length === 0) return;
    setAddingReviewers(true);
    try {
      await axios.post(route('projects.vcs.pulls.reviewers.add', [projectId, prDetails.number]), { usernames: selectedReviewerUsernames }, { params: tokenParams() });
      showNotification({ color: 'green', title: 'Reviewers added', message: 'Selected reviewers have been requested.' });
      setSelectedReviewerUsernames([]);
      // refresh PR details to reflect requested reviewers
      await openPrDetails(prDetails.number);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to add reviewers', message: msg });
    } finally {
      setAddingReviewers(false);
    }
  };

  // Issue comments
  const openIssueDetails = async (issue) => {
    setIssueDetails(issue);
    setIssueDetailsOpen(true);
    await fetchIssueComments(issue.id, 1);
  };

  const fetchIssueComments = async (issueId, page = 1) => {
    setLoadingIssueComments(true);
    try {
      const { data } = await axios.get(route('projects.vcs.issues.comments', [projectId, issueId]), { params: { ...tokenParams(), page, per_page: 20 } });
      setIssueComments(prev => (page === 1 ? data.comments : [...prev, ...data.comments]));
      setIssueCommentsHasNext(!!data.has_next);
      setIssueCommentsPage(page);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to load issue comments', message: msg });
    } finally {
      setLoadingIssueComments(false);
    }
  };

  const addIssueComment = async () => {
    if (!issueDetails || !newIssueComment.trim()) return;
    setSubmittingIssueComment(true);
    try {
      await axios.post(route('projects.vcs.issues.comments.add', [projectId, issueDetails.id]), { body: newIssueComment }, { params: tokenParams() });
      setNewIssueComment('');
      await fetchIssueComments(issueDetails.id, 1);
      showNotification({ color: 'green', title: 'Comment added', message: 'Your comment was posted' });
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to add comment', message: msg });
    } finally {
      setSubmittingIssueComment(false);
    }
  };

  // Compare export
  const downloadText = (filename, text, type = 'text/plain') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCompareJSON = () => {
    const obj = { commits: compareCommits, files: compareFiles };
    downloadText('compare.json', JSON.stringify(obj, null, 2), 'application/json');
  };

  const exportCompareCSV = () => {
    const rows = [];
    rows.push(['type', 'sha/filename', 'message', 'author', 'date', 'additions', 'deletions'].join(','));
    (compareCommits || []).forEach(c => {
      rows.push(['commit', c.sha, JSON.stringify(c.message || ''), JSON.stringify(c.author || ''), c.date || '', '', ''].join(','));
    });
    (compareFiles || []).forEach(f => {
      rows.push(['file', f.filename, '', '', '', f.additions ?? 0, f.deletions ?? 0].join(','));
    });
    downloadText('compare.csv', rows.join('\n'), 'text/csv');
  };

  // --- Missing functions implementation ---
  const fetchPrComments = async (number, page = 1) => {
    if (!number) return;
    setLoadingPrComments(true);
    setError('');
    try {
      const { data } = await axios.get(route('projects.vcs.pulls.comments', [projectId, number]), { params: { ...tokenParams(), page, per_page: 20 } });
      setPrComments(prev => (page === 1 ? data.comments : [...prev, ...data.comments]));
      setPrCommentsHasNext(!!data.has_next);
      setPrCommentsPage(page);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to load comments', message: msg });
    } finally {
      setLoadingPrComments(false);
    }
  };

  const addPrComment = async () => {
    if (!prDetails || !newComment.trim()) return;
    setSubmittingComment(true);
    setError('');
    try {
      await axios.post(route('projects.vcs.pulls.comments.add', [projectId, prDetails.number]), { body: newComment }, { params: tokenParams() });
      setNewComment('');
      await fetchPrComments(prDetails.number, 1);
      showNotification({ color: 'green', title: 'Comment added', message: 'Your comment was posted' });
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to add comment', message: msg });
    } finally {
      setSubmittingComment(false);
    }
  };

  const submitReview = async (event) => {
    if (!prDetails) return;
    setSubmittingReview(true);
    setError('');
    try {
      await axios.post(route('projects.vcs.pulls.reviews.submit', [projectId, prDetails.number]), { event, body: newComment || null }, { params: tokenParams() });
      if (event !== 'COMMENT') setNewComment('');
      showNotification({ color: 'green', title: 'Review submitted', message: event.replace('_', ' ').toLowerCase() });
      // refresh statuses and details (mergeability/checks may change)
      await Promise.all([
        fetchPrStatuses(prDetails.number),
        openPrDetails(prDetails.number),
      ]);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Failed to submit review', message: msg });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Poll mergeability and statuses when PR details are open
  useEffect(() => {
    if (!prDetailsOpen || !prDetails?.number) return;
    let stopped = false;
    const number = prDetails.number;
    const tick = async () => {
      if (stopped) return;
      await Promise.all([
        fetchPrStatuses(number),
        fetchRequiredChecks(number),
        refreshPrDetailsOnly(number),
      ]);
    };
    const id = setInterval(tick, 15000);
    // initial tick
    tick();
    return () => { stopped = true; clearInterval(id); };
  }, [prDetailsOpen, prDetails?.number]);

  const doCompare = async () => {
    if (!compareBase.trim() || !compareHead.trim()) return;
    setCompareLoading(true);
    setError('');
    try {
      const { data } = await axios.post(route('projects.vcs.compare', projectId), { base: compareBase, head: compareHead }, { params: tokenParams() });
      setCompareCommits(data.commits || []);
      setCompareFiles(data.files || []);
      if ((data.commits || []).length === 0 && (!data.files || data.files.length === 0)) {
        showNotification({ color: 'yellow', title: 'No differences', message: 'No commits or file changes found for this comparison.' });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      setError(msg);
      showNotification({ color: 'red', title: 'Compare failed', message: msg });
    } finally {
      setCompareLoading(false);
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
                    <ActionIcon variant="subtle" onClick={() => { fetchBranches(1); fetchIssues(issuesState, 1); fetchPulls(pullsState, 1); if (selectedBranch) fetchCommits(selectedBranch, 1); }}>
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
                  <Group gap="sm" justify="space-between" align="center">
                    <Group gap="sm">
                      <IconGitBranch size={16} />
                      <Text fw={600}>Branches</Text>
                    </Group>
                    <Tooltip label="The first branch with results is selected automatically"><IconInfoCircle size={14} /></Tooltip>
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
                    <ActionIcon variant="subtle" onClick={() => fetchBranches(1)} loading={branchesLoading}><IconRefresh size={16} /></ActionIcon>
                    {!branchesLoading && branchesHasNext && (
                      <Button size="xs" variant="light" onClick={() => fetchBranches(branchesPage + 1)}>Load more branches</Button>
                    )}
                  </Group>
                  <Divider my="xs" />
                  <ScrollArea.Autosize mah={240} type="scroll">
                    <Stack gap="xs">
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
                      {commitsLoading && <Group justify="center" my="sm"><Loader size="xs" /></Group>}
                      {!commitsLoading && commitsHasNext && (
                        <Group justify="center" mt="xs"><Button variant="light" size="xs" onClick={() => fetchCommits(selectedBranch, commitsPage + 1)}>Load more commits</Button></Group>
                      )}
                    </Stack>
                  </ScrollArea.Autosize>
                </Paper>

                {/* Issues */}
                <Paper withBorder p="sm" radius="sm">
                  <Group gap="sm" justify="space-between" align="center">
                    <Group gap="sm">
                      <IconPlus size={16} />
                      <Text fw={600}>Issues</Text>
                    </Group>
                    <Select value={issuesState} onChange={(v) => { setIssuesState(v); fetchIssues(v, 1); }} data={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]} style={{ width: 120 }} />
                  </Group>
                  <Divider my="xs" />
                  <ScrollArea.Autosize mah={240} type="scroll">
                    <Stack gap={8}>
                      {issues.map((i) => (
                        <Group key={i.id} gap="xs" wrap="nowrap" justify="space-between">
                          <Stack gap={2} style={{ flex: 1 }}>
                            <Anchor size="sm" fw={600} onClick={() => openIssueDetails(i)}>
                              {i.title}
                            </Anchor>
                            <Group gap={6}><Badge size="xs" variant="light" color={i.state === 'open' || i.state === 'opened' ? 'green' : 'gray'}>{i.state}</Badge>{i.url && (<Anchor href={i.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>)}</Group>
                          </Stack>
                        </Group>
                      ))}
                      {issuesLoading && <Group justify="center" my="sm"><Loader size="xs" /></Group>}
                      {!issuesLoading && issuesHasNext && (
                        <Group justify="center" mt="xs"><Button variant="light" size="xs" onClick={() => fetchIssues(issuesState, issuesPage + 1)}>Load more issues</Button></Group>
                      )}
                    </Stack>
                  </ScrollArea.Autosize>
                  <Group justify="flex-end" mt="sm">
                    <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setIssueOpen(true)}>New issue</Button>
                  </Group>
                </Paper>

                {/* Pull Requests / Merge Requests */}
                <Paper withBorder p="sm" radius="sm">
                  <Group gap="sm" justify="space-between" align="center">
                    <Group gap="sm">
                      <IconGitMerge size={16} />
                      <Text fw={600}>{integration.provider === 'github' ? 'Pull requests' : 'Merge requests'}</Text>
                    </Group>
                    <Select value={pullsState} onChange={(v) => { setPullsState(v); fetchPulls(v, 1); }} data={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }, { value: 'merged', label: 'Merged' }]} style={{ width: 140 }} />
                  </Group>
                  <Divider my="xs" />
                  <ScrollArea.Autosize mah={240} type="scroll">
                    <Stack gap={8}>
                      {pulls.map((p) => (
                        <Group key={p.number} gap="xs" wrap="nowrap" justify="space-between" align="center">
                          <Stack gap={2} style={{ flex: 1 }}>
                            <Text size="sm" fw={600}>{p.title}</Text>
                            <Group gap={6}><Badge size="xs" variant="light" color={p.state === 'open' || p.state === 'opened' ? 'green' : p.state === 'merged' ? 'blue' : 'gray'}>{p.state}</Badge>{p.url && (<Anchor href={p.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>)}</Group>
                          </Stack>
                          <Group gap="xs">
                            <Button size="xs" variant="light" onClick={() => openPrDetails(p.number)}>Details</Button>
                            {(pullsState === 'open' || p.state === 'open' || p.state === 'opened') && (
                              <Tooltip label="Merge now">
                                <ActionIcon variant="light" color="green" onClick={() => mergePull(p.number)}><IconGitMerge size={16} /></ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Group>
                      ))}
                      {pullsLoading && <Group justify="center" my="sm"><Loader size="xs" /></Group>}
                      {!pullsLoading && pullsHasNext && (
                        <Group justify="center" mt="xs"><Button variant="light" size="xs" onClick={() => fetchPulls(pullsState, pullsPage + 1)}>Load more {integration.provider === 'github' ? 'PRs' : 'MRs'}</Button></Group>
                      )}
                    </Stack>
                  </ScrollArea.Autosize>
                </Paper>
              </Group>
            </Stack>
          )}
        </Stack>
      )}

      {/* Create Issue Modal */}
      <Modal opened={issueOpen} onClose={() => setIssueOpen(false)} title="Create issue" size="md">
        <Stack>
          <TextInput label="Title" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} required />
          <Textarea label="Description" value={issueBody} onChange={(e) => setIssueBody(e.target.value)} minRows={4} autosize />
          <Group justify="flex-end">
            <Button onClick={createIssue} loading={creatingIssue} disabled={!issueTitle?.trim()}>Create</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Open PR/MR Modal */}
      <Modal opened={prOpen} onClose={() => setPrOpen(false)} title={integration?.provider === 'github' ? 'Open pull request' : 'Open merge request'} size="md">
        <Stack>
          <Select label="Source branch" data={branches.map(b => ({ value: b.name, label: b.name }))} searchable value={prSource} onChange={setPrSource} placeholder="Select source branch (or owner:branch for forks)" />
          <Select label="Target branch" data={branches.map(b => ({ value: b.name, label: b.name }))} searchable value={prTarget} onChange={setPrTarget} placeholder={defaultBranch || 'main'} />
          <TextInput label="Title" value={prTitle} onChange={(e) => setPrTitle(e.target.value)} required />
          <Textarea label="Description" value={prBody} onChange={(e) => setPrBody(e.target.value)} minRows={4} autosize />
          <Group justify="flex-end">
            <Button onClick={openPr} loading={creatingPr} disabled={!prSource?.trim() || !prTarget?.trim() || !prTitle?.trim()}>Open {integration?.provider === 'github' ? 'PR' : 'MR'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* PR Details Modal */}
      <Modal opened={prDetailsOpen} onClose={() => setPrDetailsOpen(false)} title="Request details" size="lg">
        {!prDetails || loadingPrDetails ? (
          <Group justify="center" my="md"><Loader size="sm" /></Group>
        ) : (
          <Stack>
            <Group justify="space-between">
              <Stack gap={2}>
                <Text fw={600}>{prDetails.title}</Text>
                <Group gap={6}>
                  <Badge size="xs" variant="light" color={prDetails.state === 'open' || prDetails.state === 'opened' ? 'green' : prDetails.state === 'merged' ? 'blue' : 'gray'}>{prDetails.state}</Badge>
                  {prDetails.mergeable !== null && (
                    <Badge size="xs" variant="light" color={prDetails.mergeable ? 'green' : 'red'}>{prDetails.mergeable ? 'Mergeable' : 'Not mergeable'}</Badge>
                  )}
                  {prDetails.url && <Anchor href={prDetails.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>}
                </Group>
              </Stack>
              <Group gap="xs">
                <Button size="xs" variant="light" onClick={() => { setCompareBase(prDetails.base || ''); setCompareHead(prDetails.head || ''); setCompareOpen(true); }}>Compare</Button>
                <Tooltip label="Approve">
                  <Button size="xs" color="green" variant="light" loading={submittingReview} onClick={() => submitReview('APPROVE')}>Approve</Button>
                </Tooltip>
                <Tooltip label="Request changes">
                  <Button size="xs" color="red" variant="light" loading={submittingReview} onClick={() => submitReview('REQUEST_CHANGES')}>Request changes</Button>
                </Tooltip>
              </Group>
            </Group>

            <Divider />

            {/* Status checks */}
            <Stack>
              <Group justify="space-between">
                <Text fw={600}>Status checks</Text>
                <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} loading={loadingStatuses} onClick={() => { fetchPrStatuses(prDetails.number); fetchRequiredChecks(prDetails.number); }}>Refresh statuses</Button>
              </Group>
              {prStatusSha && <Text size="xs" c="dimmed">Head SHA: {prStatusSha}</Text>}
              {requiredChecks.length > 0 && (
                <Stack gap={6}>
                  <Text size="sm" fw={600}>Required checks</Text>
                  <Stack>
                    {requiredChecks.map((ctx) => {
                      const st = prStatuses.find(s => s.context === ctx);
                      const state = st?.state || 'pending';
                      const color = state === 'success' ? 'green' : (state === 'failure' || state === 'error') ? 'red' : state === 'pending' ? 'yellow' : 'gray';
                      return (
                        <Group key={ctx} justify="space-between">
                          <Text size="sm">{ctx}</Text>
                          <Badge size="xs" color={color}>{state}</Badge>
                        </Group>
                      );
                    })}
                  </Stack>
                </Stack>
              )}
              <Stack>
                {prStatuses.length === 0 ? (
                  <Text c="dimmed">No statuses.</Text>
                ) : prStatuses.map((s, idx) => (
                  <Group key={idx} justify="space-between">
                    <Text size="sm">{s.context}</Text>
                    <Group gap={6}>
                      <Badge size="xs" color={s.state === 'success' ? 'green' : s.state === 'failure' || s.state === 'error' ? 'red' : s.state === 'pending' ? 'yellow' : 'gray'}>{s.state}</Badge>
                      {s.url && <Anchor href={s.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>}
                    </Group>
                  </Group>
                ))}
              </Stack>
            </Stack>

            <Divider />

            {/* Reviewers picker */}
            <Stack>
              <Group justify="space-between">
                <Text fw={600}>Request reviewers</Text>
                <Group>
                  {reviewersHasNext && (
                    <Button size="xs" variant="subtle" onClick={() => fetchReviewers(prDetails.number, reviewersPage + 1)} loading={loadingReviewers}>Load more</Button>
                  )}
                </Group>
              </Group>
              <MultiSelect
                data={reviewers.map(r => ({ value: r.username, label: r.name ? `${r.name} (${r.username})` : r.username }))}
                value={selectedReviewerUsernames}
                onChange={setSelectedReviewerUsernames}
                searchable
                placeholder="Select reviewers"
              />
              <Group justify="flex-end">
                <Button size="xs" onClick={addSelectedReviewers} loading={addingReviewers} disabled={selectedReviewerUsernames.length === 0}>Request reviewers</Button>
              </Group>
              {prDetails.requested_reviewers?.length > 0 && (
                <Group gap={6} wrap="wrap">
                  <Text size="sm" fw={600}>Requested:</Text>
                  {prDetails.requested_reviewers.map(u => (
                    <Badge key={u} size="xs" variant="light">{u}</Badge>
                  ))}
                </Group>
              )}
            </Stack>

            <Divider />

            {/* Comments */}
            <Stack>
              <Text fw={600}>Comments</Text>
              <Stack>
                {prComments.map(c => (
                  <Paper key={c.id} withBorder p="sm" radius="sm">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>{c.user || 'User'}</Text>
                      <Text size="xs" c="dimmed">{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</Text>
                    </Group>
                    <Text size="sm" mt={4}>{c.body}</Text>
                  </Paper>
                ))}
                {loadingPrComments && <Group justify="center" my="sm"><Loader size="xs" /></Group>}
                {!loadingPrComments && prCommentsHasNext && (
                  <Group justify="center"><Button size="xs" variant="light" onClick={() => fetchPrComments(prDetails.number, prCommentsPage + 1)}>Load more comments</Button></Group>
                )}
              </Stack>
              <Group align="flex-end" wrap="nowrap">
                <Textarea label="Add a comment / review note" value={newComment} onChange={(e) => setNewComment(e.target.value)} autosize minRows={2} style={{ flex: 1 }} />
                <Button variant="light" onClick={addPrComment} loading={submittingComment} disabled={!newComment.trim()}>Comment</Button>
              </Group>
            </Stack>
          </Stack>
        )}
      </Modal>

      {/* Issue Details Modal */}
      <Modal opened={issueDetailsOpen} onClose={() => setIssueDetailsOpen(false)} title="Issue details" size="lg">
        {!issueDetails ? (
          <Group justify="center" my="md"><Loader size="sm" /></Group>
        ) : (
          <Stack>
            <Group justify="space-between">
              <Stack gap={2}>
                <Text fw={600}>{issueDetails.title}</Text>
                <Group gap={6}>
                  <Badge size="xs" variant="light" color={issueDetails.state === 'open' || issueDetails.state === 'opened' ? 'green' : 'gray'}>{issueDetails.state}</Badge>
                  {issueDetails.url && <Anchor href={issueDetails.url} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></Anchor>}
                </Group>
              </Stack>
            </Group>
            <Divider />
            <Stack>
              <Text fw={600}>Comments</Text>
              <Stack>
                {issueComments.map(c => (
                  <Paper key={c.id} withBorder p="sm" radius="sm">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>{c.user || 'User'}</Text>
                      <Text size="xs" c="dimmed">{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</Text>
                    </Group>
                    <Text size="sm" mt={4}>{c.body}</Text>
                  </Paper>
                ))}
                {loadingIssueComments && <Group justify="center" my="sm"><Loader size="xs" /></Group>}
                {!loadingIssueComments && issueCommentsHasNext && (
                  <Group justify="center"><Button size="xs" variant="light" onClick={() => fetchIssueComments(issueDetails.id, issueCommentsPage + 1)}>Load more comments</Button></Group>
                )}
              </Stack>
              <Group align="flex-end" wrap="nowrap">
                <Textarea label="Add a comment" value={newIssueComment} onChange={(e) => setNewIssueComment(e.target.value)} autosize minRows={2} style={{ flex: 1 }} />
                <Button variant="light" onClick={addIssueComment} loading={submittingIssueComment} disabled={!newIssueComment.trim()}>Comment</Button>
              </Group>
            </Stack>
          </Stack>
        )}
      </Modal>

      {/* Compare Modal */}
      <Modal opened={compareOpen} onClose={() => setCompareOpen(false)} title="Compare" size="lg">
        <Stack>
          <Group grow>
            <TextInput label="Base" placeholder="target branch or owner:branch" value={compareBase} onChange={(e) => setCompareBase(e.target.value)} />
            <TextInput label="Head" placeholder="source branch or owner:branch" value={compareHead} onChange={(e) => setCompareHead(e.target.value)} />
          </Group>
          <Group justify="flex-end">
            <Button onClick={doCompare} loading={compareLoading} disabled={!compareBase.trim() || !compareHead.trim()}>Compare</Button>
          </Group>
          {compareLoading ? (
            <Group justify="center" my="md"><Loader size="sm" /></Group>
          ) : (
            <Group align="flex-start" grow>
              <Paper withBorder p="sm" radius="sm">
                <Text fw={600} mb={6}>Commits</Text>
                <ScrollArea.Autosize mah={260} type="scroll">
                  <Stack gap={6}>
                    {compareCommits.length === 0 && <Text c="dimmed">No commits.</Text>}
                    {compareCommits.map(c => (
                      <div key={c.sha}>
                        <Text size="sm" fw={600}>{c.message}</Text>
                        <Text size="xs" c="dimmed">{c.sha.substring(0,7)} · {c.author || 'Unknown'} · {c.date ? new Date(c.date).toLocaleString() : ''}</Text>
                      </div>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Paper>
              <Paper withBorder p="sm" radius="sm">
                <Text fw={600} mb={6}>Files</Text>
                <ScrollArea.Autosize mah={260} type="scroll">
                  <Stack gap={6}>
                    {(!compareFiles || compareFiles.length === 0) && <Text c="dimmed">No file list available.</Text>}
                    {compareFiles.map(f => (
                      <Group key={f.filename} justify="space-between">
                        <Text size="sm">{f.filename}</Text>
                        <Badge size="xs" variant="light">+{f.additions} / -{f.deletions}</Badge>
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Paper>
            </Group>
          )}
          <Group justify="space-between" mt="sm">
            <Group>
              <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} onClick={exportCompareCSV}>Export CSV</Button>
              <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} onClick={exportCompareJSON}>Export JSON</Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
