<?php

namespace App\Http\Controllers\Project;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectVcsIntegration;
use App\Services\Vcs\VcsClientFactory;
use Illuminate\Http\Request;

class VcsController extends Controller
{
    public function showIntegration(Project $project)
    {
        $this->authorize('view', $project);
        $integration = $project->vcsIntegration;
        if (! $integration) {
            return response()->json(['integration' => null]);
        }

        return response()->json([
            'integration' => [
                'provider' => $integration->provider,
                'repo' => $integration->repo,
                'base_url' => $integration->base_url,
                'default_branch' => $integration->default_branch,
                'has_token' => ! empty($integration->getRawOriginal('token')),
            ],
        ]);
    }

    public function upsertIntegration(Request $request, Project $project)
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

    public function destroyIntegration(Project $project)
    {
        $this->authorize('update', $project);
        if ($project->vcsIntegration) {
            $project->vcsIntegration->delete();
        }

        return response()->json(['status' => 'ok']);
    }

    private function requireIntegration(Project $project): ProjectVcsIntegration
    {
        $integration = $project->vcsIntegration;
        abort_unless($integration, 404, 'VCS integration not configured for this project');

        return $integration;
    }

    public function branches(Project $project)
    {
        $this->authorize('view', $project);
        try {
            $integration = $this->requireIntegration($project);
            $client = VcsClientFactory::make($integration);

            return response()->json(['branches' => $client->listBranches()]);
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
            $perPage = (int) ($request->query('per_page', 20));
            $client = VcsClientFactory::make($integration);

            return response()->json(['commits' => $client->listCommits($branch, $perPage)]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function listIssues(Project $project)
    {
        $this->authorize('view', $project);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project));

            return response()->json(['issues' => $client->listIssues()]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function listPulls(Project $project)
    {
        $this->authorize('view', $project);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project));

            return response()->json(['pulls' => $client->listPullRequests()]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function createIssue(Request $request, Project $project)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'title' => 'required|string',
            'body' => 'nullable|string',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project));
            $issue = $client->createIssue($data['title'], $data['body'] ?? null);

            return response()->json(['issue' => $issue]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function openPr(Request $request, Project $project)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'source_branch' => 'required|string',
            'target_branch' => 'required|string',
            'title' => 'required|string',
            'body' => 'nullable|string',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project));
            $pr = $client->openMergeRequest($data['source_branch'], $data['target_branch'], $data['title'], $data['body'] ?? null);

            return response()->json(['pull' => $pr]);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function merge(Request $request, Project $project)
    {
        $this->authorize('update', $project);
        $data = $request->validate([
            'number' => 'required',
        ]);
        try {
            $client = VcsClientFactory::make($this->requireIntegration($project));
            $res = $client->mergeRequest($data['number']);

            return response()->json($res);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }
}
