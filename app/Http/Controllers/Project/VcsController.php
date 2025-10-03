<?php

namespace App\Http\Controllers\Project;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectVcsIntegration;
use App\Models\ProjectVcsUserToken;
use App\Services\Vcs\VcsClientFactory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class VcsController extends Controller
{
    private function cacheTtl(): int
    {
        return (int) (config('vcs.cache_ttl', 300)); // default 5 minutes
    }

    private function cacheVersion(Project $project): int
    {
        $key = "vcs:proj:{$project->id}:ver";
        return (int) Cache::get($key, 1);
    }

    private function bumpProjectCache(Project $project): void
    {
        $key = "vcs:proj:{$project->id}:ver";
        $ver = (int) Cache::get($key, 1);
        Cache::forever($key, $ver + 1);
    }

    /**
     * Cache helper that namespaces keys by project, provider, repo, token mode and version.
     * If a user token is used, the auth user id is included to avoid leaking across users.
     */
    private function cacheRemember(Project $project, ProjectVcsIntegration $integration, string $section, array $params, bool $usingUserToken, \Closure $callback)
    {
        $ver = $this->cacheVersion($project);
        $uidSeg = $usingUserToken ? ('u:'.(auth()->id() ?: '0')) : 'p';
        $hash = md5($section.':'.json_encode($params));
        $repoHash = md5((string) $integration->repo);
        $key = "vcs:proj:{$project->id}:v{$ver}:{$integration->provider}:{$repoHash}:{$uidSeg}:{$hash}";

        return Cache::remember($key, $this->cacheTtl(), $callback);
    }

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

        // Invalidate cached data after integration changes
        $this->bumpProjectCache($project);

        return response()->json(['status' => 'ok']);
    }

    public function destroyIntegration(Project $project): \Illuminate\Http\JsonResponse
    {
        $this->authorize('update', $project);
        if ($project->vcsIntegration) {
            $project->vcsIntegration->delete();
        }

        $this->bumpProjectCache($project);

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

        $this->bumpProjectCache($project);

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

        $this->bumpProjectCache($project);

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
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $page = (int) $request->query('page', 1);
            $perPage = (int) $request->query('per_page', 30);
            $res = $this->cacheRemember($project, $integration, 'branches', compact('page', 'perPage'), $usingUserToken, function () use ($integration, $token, $page, $perPage) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->listBranches($page, $perPage);
            });

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
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $res = $this->cacheRemember($project, $integration, 'commits', compact('branch', 'page', 'perPage'), $usingUserToken, function () use ($integration, $token, $branch, $page, $perPage) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->listCommits($branch, $page, $perPage);
            });

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
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $res = $this->cacheRemember($project, $integration, 'issues', compact('state', 'page', 'perPage'), $usingUserToken, function () use ($integration, $token, $state, $page, $perPage) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->listIssues($state, $page, $perPage);
            });

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
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $res = $this->cacheRemember($project, $integration, 'pulls', compact('state', 'page', 'perPage'), $usingUserToken, function () use ($integration, $token, $state, $page, $perPage) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->listPullRequests($state, $page, $perPage);
            });

            return response()->json(['pulls' => $res['items'], 'has_next' => $res['has_next']]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function pullDetails(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $pr = $this->cacheRemember($project, $integration, 'pull_details', compact('number'), $usingUserToken, function () use ($integration, $token, $number) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->getPullRequest($number);
            });

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
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $res = $this->cacheRemember($project, $integration, 'pull_comments', compact('number', 'page', 'perPage'), $usingUserToken, function () use ($integration, $token, $number, $page, $perPage) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->listPullComments($number, $page, $perPage);
            });

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
            $this->bumpProjectCache($project);

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
            $this->bumpProjectCache($project);

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
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $base = $data['base'];
            $head = $data['head'];
            $res = $this->cacheRemember($project, $integration, 'compare', compact('base', 'head'), $usingUserToken, function () use ($integration, $token, $base, $head) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->compare($base, $head);
            });

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
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $res = $this->cacheRemember($project, $integration, 'reviewers', compact('page', 'perPage'), $usingUserToken, function () use ($integration, $token, $page, $perPage) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->listPotentialReviewers($page, $perPage);
            });

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
            $this->bumpProjectCache($project);

            return response()->json($res);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function pullStatuses(Project $project, Request $request, int|string $number)
    {
        $this->authorize('view', $project);
        try {
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $res = $this->cacheRemember($project, $integration, 'pull_statuses', compact('number'), $usingUserToken, function () use ($integration, $token, $number) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->getPullStatuses($number);
            });

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
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            // This returns array of contexts; safe to cache quickly
            $res = $this->cacheRemember($project, $integration, 'pull_required_checks', compact('number'), $usingUserToken, function () use ($integration, $token, $number) {
                $client = VcsClientFactory::make($integration, $token);
                // Get base branch from PR details
                $pr = $client->getPullRequest($number);
                $base = $pr['base'] ?? null;
                $required = [];
                if ($base && method_exists($client, 'getRequiredStatusContexts')) {
                    /** @var array $required */
                    $required = $client->getRequiredStatusContexts($base);
                }
                return ['required' => array_values($required)];
            });

            return response()->json($res);
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
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $res = $this->cacheRemember($project, $integration, 'issue_comments', compact('issueId', 'page', 'perPage'), $usingUserToken, function () use ($integration, $token, $issueId, $page, $perPage) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->listIssueComments($issueId, $page, $perPage);
            });

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
            $this->bumpProjectCache($project);

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
            $this->bumpProjectCache($project);

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
            $this->bumpProjectCache($project);

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
            $this->bumpProjectCache($project);

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
                $this->bumpProjectCache($project);

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
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $pr = $this->cacheRemember($project, $integration, 'pull_details', compact('number'), $usingUserToken, function () use ($integration, $token, $number) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->getPullRequest($number);
            });
            $base = $pr['base'] ?? null;
            $head = $pr['head'] ?? null;
            if (! $base || ! $head) {
                abort(422, 'PR does not have base/head information');
            }
            $res = $this->cacheRemember($project, $integration, 'compare', compact('base', 'head'), $usingUserToken, function () use ($integration, $token, $base, $head) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->compare($base, $head);
            });

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
            $integration = $this->requireIntegration($project);
            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = !is_null($token);
            $res = $this->cacheRemember($project, $integration, 'pull_review_comments', compact('number', 'page', 'perPage'), $usingUserToken, function () use ($integration, $token, $number, $page, $perPage) {
                $client = VcsClientFactory::make($integration, $token);
                return $client->listPullReviewComments($number, $page, $perPage);
            });

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
            $this->bumpProjectCache($project);

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
            $defaultBranch = $integration->default_branch ?: 'main';
            $branch = (string) ($request->query('branch') ?: $defaultBranch);
            $maxPages = (int) $request->query('pages', 5);
            $perPage = (int) $request->query('per_page', 50);

            $token = $this->resolveToken($project, $integration, $request);
            $usingUserToken = ! is_null($token);

            $cached = $this->cacheRemember(
                $project,
                $integration,
                'stats',
                compact('branch', 'maxPages', 'perPage'),
                $usingUserToken,
                function () use ($integration, $token, $branch, $defaultBranch, $maxPages, $perPage) {
                    $client = VcsClientFactory::make($integration, $token);

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
                            if (($res['has_next'] ?? false) === false) {
                                break;
                            }
                        }
                        return $acc;
                    };

                    $allCommits = $fetchCommits($branch);
                    $allCommitsDefault = ($branch === $defaultBranch) ? $allCommits : $fetchCommits($defaultBranch);

                    $latestCommits = array_slice($allCommits, 0, 10);

                    $now = now();
                    $windows = [
                        'week' => $now->copy()->startOfWeek(),
                        'month' => $now->copy()->startOfMonth(),
                        'year' => $now->copy()->startOfYear(),
                    ];
                    $tops = ['week' => [], 'month' => [], 'year' => []];

                    foreach ($windows as $key => $start) {
                        $counts = [];
                        foreach ($allCommitsDefault as $c) {
                            if (empty($c['date'])) {
                                continue;
                            }
                            $dt = \Illuminate\Support\Carbon::parse($c['date']);
                            if ($dt->lt($start)) {
                                continue;
                            }
                            $author = $c['author'] ?: 'Unknown';
                            $counts[$author] = ($counts[$author] ?? 0) + 1;
                        }
                        arsort($counts);
                        $tops[$key] = array_map(
                            fn ($name, $count) => ['name' => $name, 'count' => $count],
                            array_keys($counts),
                            array_values($counts)
                        );
                        $tops[$key] = array_slice($tops[$key], 0, 10);
                    }

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
                                    'created_at' => $p['created_at'] ?? null,
                                ];
                            }
                        }
                    } catch (\Throwable $_) {
                        // provider may not support listing merged separately; ignore
                    }

                    $recentIssues = [];
                    try {
                        $openIssues = $client->listIssues('open', 1, 10)['items'] ?? [];
                        foreach ($openIssues as $i) {
                            $recentIssues[] = [
                                'id' => $i['id'] ?? null,
                                'title' => $i['title'] ?? '',
                                'state' => $i['state'] ?? 'open',
                                'url' => $i['url'] ?? null,
                                'created_at' => $i['created_at'] ?? null,
                            ];
                        }
                    } catch (\Throwable $_) {
                        // ignore issues if provider does not support endpoint
                    }

                    $byDay = [];
                    $byWeek = [];
                    try {
                        $sample = array_slice($recentPulls, 0, 20);
                        foreach ($sample as $rp) {
                            if (! isset($rp['number'])) {
                                continue;
                            }
                            try {
                                $pr = $client->getPullRequest($rp['number']);
                            } catch (\Throwable $_e) {
                                continue;
                            }
                            $created = $pr['created_at'] ?? null;
                            $mergedAt = $pr['merged_at'] ?? ($pr['closed_at'] ?? null);
                            if ($created) {
                                $d = \Illuminate\Support\Carbon::parse($created)->toDateString();
                                $w = \Illuminate\Support\Carbon::parse($created)->isoFormat('GGGG-[W]WW');
                                $byDay[$d]['opened'] = ($byDay[$d]['opened'] ?? 0) + 1;
                                $byWeek[$w]['opened'] = ($byWeek[$w]['opened'] ?? 0) + 1;
                            }
                            if (($rp['state'] ?? null) === 'merged' && $mergedAt) {
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
                    foreach ($byDay as $d => $vals) {
                        $byDayArr[] = [
                            'date' => $d,
                            'opened' => (int) ($vals['opened'] ?? 0),
                            'merged' => (int) ($vals['merged'] ?? 0),
                        ];
                    }
                    $byWeekArr = [];
                    foreach ($byWeek as $w => $vals) {
                        $byWeekArr[] = [
                            'week' => $w,
                            'opened' => (int) ($vals['opened'] ?? 0),
                            'merged' => (int) ($vals['merged'] ?? 0),
                        ];
                    }

                    return [
                        'default_branch' => $defaultBranch,
                        'branch' => $branch,
                        'latest_commits' => $latestCommits,
                        'top_committers' => $tops,
                        'recent_pulls' => array_slice($recentPulls, 0, 10),
                        'recent_issues' => array_slice($recentIssues, 0, 10),
                        'pr_activity' => ['by_day' => $byDayArr, 'by_week' => $byWeekArr],
                    ];
                }
            );

            return response()->json($cached);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
