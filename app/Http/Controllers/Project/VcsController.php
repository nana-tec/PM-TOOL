<?php

namespace App\Http\Controllers\Project;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectVcsIntegration;
use App\Models\ProjectVcsUserToken;
use App\Services\Vcs\VcsClientFactory;
use Illuminate\Http\Request;

class VcsController extends Controller
{
    public function showIntegration(Project $project): \Illuminate\Http\JsonResponse
    {
        $this->authorize('view', $project);
        $integration = $project->vcsIntegration;
        if (! $integration) {
            return response()->json(['integration' => null]);
        }

        $userTokenExists = ProjectVcsUserToken::where('project_id', $project->id)
            ->where('user_id', auth()->id())
            ->where('provider', $integration->provider)
            ->exists();

        return response()->json([
            'integration' => [
                'provider' => $integration->provider,
                'repo' => $integration->repo,
                'base_url' => $integration->base_url,
                'default_branch' => $integration->default_branch,
                'has_token' => ! empty($integration->getRawOriginal('token')),
                'has_user_token' => $userTokenExists,
            ],
        ]);
    }

    public function upsertIntegration(Request $request, Project $project): \Illuminate\Http\JsonResponse
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'provider' => 'required|in:github,gitlab',
            'repo' => 'required|string',
            'base_url' => 'nullable|string',
            'default_branch' => 'nullable|string',
            'token' => 'nullable|string',
        ]);

        $integration = $project->vcsIntegration ?: new ProjectVcsIntegration(['project_id' => $project->id]);
        $integration->provider = $data['provider'];
        $integration->repo = $data['repo'];
        $integration->base_url = $data['base_url'] ?? null;
        $integration->default_branch = $data['default_branch'] ?? null;
        if (! empty($data['token'])) {
            $integration->token = $data['token'];
        }
        $integration->project()->associate($project);
        $integration->save();

        return response()->json(['status' => 'ok']);
    }

    public function destroyIntegration(Project $project): \Illuminate\Http\JsonResponse
    {
        $this->authorize('update', $project);
        if ($project->vcsIntegration) {
            $project->vcsIntegration->delete();
        }

        return response()->json(['status' => 'ok']);
    }

    public function setUserToken(Request $request, Project $project)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'token' => 'required|string',
        ]);
        $integration = $this->requireIntegration($project);
        ProjectVcsUserToken::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => auth()->id(),
                'provider' => $integration->provider,
            ],
            [
                'token' => $data['token'],
            ]
        );

        return response()->json(['status' => 'ok']);
    }

    public function deleteUserToken(Project $project)
    {
        $this->authorize('update', $project);
        $integration = $this->requireIntegration($project);
        ProjectVcsUserToken::where('project_id', $project->id)
            ->where('user_id', auth()->id())
            ->where('provider', $integration->provider)
            ->delete();

        return response()->json(['status' => 'ok']);
    }

    private function requireIntegration(Project $project): ProjectVcsIntegration
    {
        $integration = $project->vcsIntegration;
        abort_unless($integration, 404, 'VCS integration not configured for this project');

        return $integration;
    }

    private function resolveToken(Project $project, ProjectVcsIntegration $integration, Request $request): ?string
    {
        $preferred = $request->query('use_token'); // 'user' | 'project' | null
        $userToken = ProjectVcsUserToken::where('project_id', $project->id)
            ->where('user_id', auth()->id())
            ->where('provider', $integration->provider)
            ->first();

        if ($preferred === 'project') {
            return null; // force project token
        }
        if ($preferred === 'user') {
            return $userToken?->token;
        }

        // default: prefer user token if exists
        return $userToken?->token;
    }

    public function branches(Project $project, Request $request)
    {
        $this->authorize('view', $project);
        try {
            $integration = $this->requireIntegration($project);
            $client = VcsClientFactory::make($integration, $this->resolveToken($project, $integration, $request));
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 30);
            $res = $client->listBranches($page, $perPage);

            return response()->json(['branches' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function commits(Request $request, Project $project)
    {
        $this->authorize('view', $project);
        try {
            $integration = $this->requireIntegration($project);
            $branch = $request->query('branch') ?: ($integration->default_branch ?: 'main');
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 20);
            $client = VcsClientFactory::make($integration, $this->resolveToken($project, $integration, $request));
            $res = $client->listCommits($branch, $page, $perPage);

            return response()->json(['commits' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function listIssues(Project $project, Request $request)
    {
        $this->authorize('view', $project);
        try {
            $state = (string) $request->query('state', 'open');
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 20);
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->listIssues($state, $page, $perPage);

            return response()->json(['issues' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function listPulls(Project $project, Request $request)
    {
        $this->authorize('view', $project);
        try {
            $state = (string) $request->query('state', 'open');
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 20);
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->listPullRequests($state, $page, $perPage);

            return response()->json(['pulls' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function pullDetails(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $pr = $client->getPullRequest($number);

            return response()->json(['pull' => $pr]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function pullComments(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 20);
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->listPullComments($number, $page, $perPage);

            return response()->json(['comments' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function addPullComment(Project $project, Request $request, int|string $number)
    {
        $this->authorize('update', $project);
        $data = $request->validate(['body' => 'required|string|min:1']);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $c = $client->createPullComment($number, $data['body']);

            return response()->json(['comment' => $c]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function submitReview(Project $project, Request $request, int|string $number)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'event' => 'required|string|in:APPROVE,REQUEST_CHANGES,COMMENT',
            'body' => 'nullable|string',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->submitReview($number, $data['event'], $data['body'] ?? null);

            return response()->json($res);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function compare(Project $project, Request $request)
    {
        $this->authorize('view', $project);
        $data = $request->validate([
            'base' => 'required|string',
            'head' => 'required|string',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->compare($data['base'], $data['head']);

            return response()->json($res);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function listReviewers(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 50);
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->listPotentialReviewers($page, $perPage);

            return response()->json(['reviewers' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function addReviewers(Project $project, Request $request, int|string $number)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'usernames' => 'required|array|min:1',
            'usernames.*' => 'string',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->requestReviewers($number, $data['usernames']);

            return response()->json($res);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function pullStatuses(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->getPullStatuses($number);

            return response()->json($res);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function pullRequiredChecks(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $integration = $this->requireIntegration($project);
            $client = VcsClientFactory::make($integration, $this->resolveToken($project, $integration, $request));
            // Get base branch from PR details
            $pr = $client->getPullRequest($number);
            $base = $pr['base'] ?? null;
            $required = [];
            if ($base && method_exists($client, 'getRequiredStatusContexts')) {
                /** @var array $required */
                $required = $client->getRequiredStatusContexts($base);
            }

            return response()->json(['required' => array_values($required)]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function issueComments(Project $project, Request $request, int|string $issueId)
    {
        $this->authorize('view', $project);
        try {
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 20);
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->listIssueComments($issueId, $page, $perPage);

            return response()->json(['comments' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function addIssueComment(Project $project, Request $request, int|string $issueId)
    {
        $this->authorize('update', $project);
        $data = $request->validate(['body' => 'required|string|min:1']);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $c = $client->createIssueComment($issueId, $data['body']);

            return response()->json(['comment' => $c]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    // --- Added missing endpoints ---
    public function createIssue(Project $project, Request $request)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'title' => 'required|string|min:1',
            'body' => 'nullable|string',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $issue = $client->createIssue($data['title'], $data['body'] ?? null);

            return response()->json(['issue' => $issue]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function openPr(Project $project, Request $request)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'source_branch' => 'required|string',
            'target_branch' => 'required|string',
            'title' => 'required|string|min:1',
            'body' => 'nullable|string',
            'draft' => 'sometimes|boolean',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $pr = $client->openMergeRequest($data['source_branch'], $data['target_branch'], $data['title'], $data['body'] ?? null, ['draft' => (bool) ($data['draft'] ?? false)]);

            return response()->json(['pull' => $pr]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function merge(Project $project, Request $request)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'number' => 'required',
            'strategy' => 'sometimes|nullable|string|in:merge,squash,rebase',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->mergeRequest($data['number'], $data['strategy'] ?? null);

            return response()->json($res);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function readyForReview(Project $project, Request $request, int|string $number)
    {
        $this->authorize('update', $project);
        try {
            $integration = $this->requireIntegration($project);
            $client = VcsClientFactory::make($integration, $this->resolveToken($project, $integration, $request));
            if (method_exists($client, 'markReadyForReview')) {
                /** @var array $res */
                $res = $client->markReadyForReview($number);

                return response()->json($res);
            }

            return response()->json(['status' => 'noop']);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function compareByPr(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $integration = $this->requireIntegration($project);
            $client = VcsClientFactory::make($integration, $this->resolveToken($project, $integration, $request));
            $pr = $client->getPullRequest($number);
            $base = $pr['base'] ?? null;
            $head = $pr['head'] ?? null;
            if (! $base || ! $head) {
                abort(422, 'PR does not have base/head information');
            }
            $res = $client->compare($base, $head);

            return response()->json($res + ['base' => $base, 'head' => $head]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function listPullReviewComments(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 50);
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->listPullReviewComments($number, $page, $perPage);

            return response()->json(['comments' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function replyPullReviewComment(Project $project, Request $request, int|string $number, int|string $threadId)
    {
        $this->authorize('update', $project);
        $data = $request->validate(['body' => 'required|string|min:1']);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project), $this->resolveToken($project, $this->requireIntegration($project), $request));
            $res = $client->replyPullReviewComment($number, $threadId, $data['body']);

            return response()->json($res);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function stats(Project $project, Request $request)
    {
        $this->authorize('view', $project);
        try {
            $integration = $this->requireIntegration($project);
            $client = VcsClientFactory::make($integration, $this->resolveToken($project, $integration, $request));
            $defaultBranch = $integration->default_branch ?: 'main';
            $branch = (string) ($request->query('branch') ?: $defaultBranch);
             $maxPages = (int) $request->query('pages', 5); // fetch up to ~5 pages of commits
             $perPage = (int) $request->query('per_page', 50);

             $fetchCommits = function (string $ref) use ($client, $maxPages, $perPage) {
                $acc = [];
                for ($page = 1; $page <= max(1, $maxPages); $page++) {
                    $res = $client->listCommits($ref, $page, $perPage);
                    $items = $res['items'] ?? [];
                    foreach ($items as $c) {
                        $acc[] = [
                            'sha' => $c['sha'] ?? '',
                            'message' => $c['message'] ?? '',
                            'author' => $c['author'] ?? 'Unknown',
                            'date' => $c['date'] ?? null,
                            'url' => $c['url'] ?? null,
                        ];
                    }
                    if (($res['has_next'] ?? false) === false) break;
                }
                return $acc;
            };

            $allCommits = $fetchCommits($branch);
            $allCommitsDefault = ($branch === $defaultBranch) ? $allCommits : $fetchCommits($defaultBranch);

             // latest commits (most recent first as returned by provider)
             $latestCommits = array_slice($allCommits, 0, 10);

             // Top committers by windows (week, month, year)
             $now = now();
             $windows = [
                 'week' => $now->copy()->startOfWeek(),
                 'month' => $now->copy()->startOfMonth(),
                 'year' => $now->copy()->startOfYear(),
             ];
             $tops = [ 'week' => [], 'month' => [], 'year' => [] ];

             foreach ($windows as $key => $start) {
                 $counts = [];
                foreach ($allCommitsDefault as $c) {
                     if (empty($c['date'])) continue;
                     $dt = \Illuminate\Support\Carbon::parse($c['date']);
                     if ($dt->lt($start)) continue;
                     $author = $c['author'] ?: 'Unknown';
                     $counts[$author] = ($counts[$author] ?? 0) + 1;
                 }
                 arsort($counts);
                 $tops[$key] = array_map(function ($name, $count) {
                     return ['name' => $name, 'count' => $count];
                 }, array_keys($counts), array_values($counts));
                 $tops[$key] = array_slice($tops[$key], 0, 10);
             }

             // Recent PRs: take first page of open + merged for a quick view
             $recentPulls = [];
             try {
                 $open = $client->listPullRequests('open', 1, 10)['items'] ?? [];
                 $merged = $client->listPullRequests('merged', 1, 10)['items'] ?? [];
                 foreach ([$open, $merged] as $list) {
                     foreach ($list as $p) {
                         $recentPulls[] = [
                             'number' => $p['number'] ?? null,
                             'title' => $p['title'] ?? '',
                             'state' => $p['state'] ?? 'open',
                             'url' => $p['url'] ?? null,
                         ];
                     }
                 }
             } catch (\Throwable $_) {
                 // provider may not support listing merged separately; ignore
             }

            // PR activity (best-effort): group opened/merged counts by day and by ISO week
            $byDay = [];
            $byWeek = [];
            try {
                $sample = array_slice($recentPulls, 0, 20);
                foreach ($sample as $rp) {
                    if (!isset($rp['number'])) continue;
                    try {
                        $pr = $client->getPullRequest($rp['number']);
                    } catch (\Throwable $_e) { continue; }
                    $created = $pr['created_at'] ?? null;
                    $mergedAt = $pr['merged_at'] ?? ($pr['closed_at'] ?? null);
                    if ($created) {
                        $d = \Illuminate\Support\Carbon::parse($created)->toDateString();
                        $w = \Illuminate\Support\Carbon::parse($created)->isoFormat('GGGG-[W]WW');
                        $byDay[$d]['opened'] = ($byDay[$d]['opened'] ?? 0) + 1;
                        $byWeek[$w]['opened'] = ($byWeek[$w]['opened'] ?? 0) + 1;
                    }
                    if ($rp['state'] === 'merged' && $mergedAt) {
                        $d = \Illuminate\Support\Carbon::parse($mergedAt)->toDateString();
                        $w = \Illuminate\Support\Carbon::parse($mergedAt)->isoFormat('GGGG-[W]WW');
                        $byDay[$d]['merged'] = ($byDay[$d]['merged'] ?? 0) + 1;
                        $byWeek[$w]['merged'] = ($byWeek[$w]['merged'] ?? 0) + 1;
                    }
                }
            } catch (\Throwable $_) {
                // ignore if provider does not expose timestamps
            }
            ksort($byDay);
            ksort($byWeek);
            $byDayArr = [];
            foreach ($byDay as $d => $vals) { $byDayArr[] = ['date' => $d, 'opened' => (int)($vals['opened'] ?? 0), 'merged' => (int)($vals['merged'] ?? 0)]; }
            $byWeekArr = [];
            foreach ($byWeek as $w => $vals) { $byWeekArr[] = ['week' => $w, 'opened' => (int)($vals['opened'] ?? 0), 'merged' => (int)($vals['merged'] ?? 0)]; }

             return response()->json([
                'branch' => $branch,
                'default_branch' => $defaultBranch,
                'branch' => $branch,
                 'latest_commits' => $latestCommits,
                 'top_committers' => $tops,
                 'recent_pulls' => array_slice($recentPulls, 0, 10),
                'pr_activity' => [ 'by_day' => $byDayArr, 'by_week' => $byWeekArr ],
             ]);
         } catch (\Throwable $e) {
             return response()->json(['error' => $e->getMessage()], 422);
         }
     }
}
