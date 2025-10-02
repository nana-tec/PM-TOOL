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
}
