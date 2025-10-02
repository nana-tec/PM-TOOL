<?php

namespace App\Services\Vcs;

use App\Models\ProjectVcsIntegration;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class VcsGitlabClient implements VcsClientInterface
{
    public function __construct(private Client $http, private ProjectVcsIntegration $integration, private ?string $token = null)
    {
    }

    private function baseApi(): string
    {
        $base = $this->integration->base_url ?: 'https://gitlab.com';
        return rtrim($base, '/') . '/api/v4';
    }

    private function headers(): array
    {
        return [
            'Accept' => 'application/json',
            'PRIVATE-TOKEN' => ($this->token ?? $this->integration->token),
        ];
    }

    private function request(string $method, string $path, array $options = []): array
    {
        $projectId = rawurlencode($this->integration->repo); // path like group/project
        $url = $this->baseApi() . '/projects/' . $projectId . $path;
        $options['headers'] = ($options['headers'] ?? []) + $this->headers();
        $res = $this->http->request($method, $url, $options);
        $body = (string) $res->getBody();
        $data = $body !== '' ? json_decode($body, true) : [];
        $headers = $res->getHeaders();
        return [$data, $headers];
    }

    private function hasNextFromHeaders(array $headers): bool
    {
        $next = $headers['X-Next-Page'][0] ?? '';
        return is_string($next) && $next !== '';
    }

    private function api(string $method, string $path, array $options = []): array
    {
        try {
            [$data] = $this->request($method, $path, $options);
            return $data;
        } catch (GuzzleException $e) {
            throw $e;
        }
    }

    public function listBranches(int $page = 1, int $perPage = 30): array
    {
        [$data, $headers] = $this->request('GET', '/repository/branches?per_page=' . $perPage . '&page=' . $page);
        $items = array_map(fn ($b) => ['name' => $b['name'], 'commit_sha' => $b['commit']['id'] ?? null], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function listCommits(string $branch, int $page = 1, int $perPage = 20): array
    {
        [$data, $headers] = $this->request('GET', '/repository/commits?ref_name=' . urlencode($branch) . '&per_page=' . $perPage . '&page=' . $page);
        $items = array_map(function ($c) {
            return [
                'sha' => $c['id'],
                'message' => $c['title'] ?? ($c['message'] ?? ''),
                'author' => $c['author_name'] ?? null,
                'date' => $c['created_at'] ?? null,
                'url' => $c['web_url'] ?? null,
            ];
        }, $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function createIssue(string $title, ?string $body = null): array
    {
        $payload = ['form_params' => array_filter(['title' => $title, 'description' => $body], fn ($v) => $v !== null)];
        $data = $this->api('POST', '/issues', $payload);
        return ['id' => $data['iid'] ?? $data['id'] ?? 0, 'url' => $data['web_url'] ?? null];
    }

    public function openMergeRequest(string $sourceBranch, string $targetBranch, string $title, ?string $body = null): array
    {
        $payload = ['form_params' => ['source_branch' => $sourceBranch, 'target_branch' => $targetBranch, 'title' => $title, 'description' => $body]];
        $data = $this->api('POST', '/merge_requests', $payload);
        return ['number' => $data['iid'] ?? 0, 'url' => $data['web_url'] ?? null];
    }

    public function mergeRequest(int|string $number): array
    {
        $data = $this->api('PUT', '/merge_requests/' . urlencode((string) $number) . '/merge', ['form_params' => []]);
        $merged = isset($data['merged']) ? (bool) $data['merged'] : (($data['state'] ?? '') === 'merged');
        return ['merged' => $merged, 'message' => $data['message'] ?? null];
    }

    public function listPullRequests(string $state = 'open', int $page = 1, int $perPage = 20): array
    {
        $gitlabState = match ($state) {
            'open' => 'opened',
            'closed' => 'closed',
            'merged' => 'merged',
            default => 'opened',
        };
        [$data, $headers] = $this->request('GET', '/merge_requests?state=' . urlencode($gitlabState) . '&per_page=' . $perPage . '&page=' . $page);
        $items = array_map(fn ($m) => ['number' => $m['iid'], 'title' => $m['title'], 'state' => $m['state'], 'url' => $m['web_url'] ?? null], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function listIssues(string $state = 'open', int $page = 1, int $perPage = 20): array
    {
        $gitlabState = match ($state) {
            'open' => 'opened',
            'closed' => 'closed',
            default => 'opened',
        };
        [$data, $headers] = $this->request('GET', '/issues?state=' . urlencode($gitlabState) . '&per_page=' . $perPage . '&page=' . $page);
        $items = array_map(fn ($i) => ['id' => $i['iid'] ?? $i['id'] ?? 0, 'title' => $i['title'], 'state' => $i['state'], 'url' => $i['web_url'] ?? null], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function getPullRequest(int|string $number): array
    {
        $m = $this->api('GET', '/merge_requests/' . urlencode((string) $number));
        return [
            'number' => $m['iid'],
            'title' => $m['title'],
            'state' => $m['state'],
            'mergeable' => ($m['merge_status'] ?? null) === 'can_be_merged' ? true : (($m['merge_status'] ?? null) === 'cannot_be_merged' ? false : null),
            'merged' => ($m['state'] ?? '') === 'merged',
            'requested_reviewers' => array_map(fn ($u) => $u['username'], $m['reviewers'] ?? []),
            'url' => $m['web_url'] ?? null,
            'base' => $m['target_branch'] ?? null,
            'head' => $m['source_branch'] ?? null,
        ];
    }

    public function listPullComments(int|string $number, int $page = 1, int $perPage = 20): array
    {
        [$data, $headers] = $this->request('GET', '/merge_requests/' . urlencode((string) $number) . '/notes?per_page=' . $perPage . '&page=' . $page);
        $items = array_map(fn ($n) => [
            'id' => $n['id'],
            'user' => $n['author']['username'] ?? null,
            'body' => $n['body'] ?? '',
            'created_at' => $n['created_at'] ?? '',
        ], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function createPullComment(int|string $number, string $body): array
    {
        $data = $this->api('POST', '/merge_requests/' . urlencode((string) $number) . '/notes', ['form_params' => ['body' => $body]]);
        return ['id' => $data['id'] ?? 0, 'url' => $data['web_url'] ?? null];
    }

    public function submitReview(int|string $number, string $event, ?string $body = null): array
    {
        $event = strtoupper($event);
        if ($event === 'APPROVE') {
            $this->api('POST', '/merge_requests/' . urlencode((string) $number) . '/approve', ['form_params' => []]);
            return ['status' => 'ok'];
        }
        // GitLab has no direct REQUEST_CHANGES; add a note
        $this->createPullComment($number, $body ?: ($event === 'REQUEST_CHANGES' ? 'Requesting changes.' : 'Comment'));
        return ['status' => 'ok'];
    }

    public function compare(string $base, string $head): array
    {
        // GitLab uses from (base) and to (head)
        [$data] = $this->request('GET', '/repository/compare?from=' . rawurlencode($base) . '&to=' . rawurlencode($head));
        $commits = array_map(fn ($c) => [
            'sha' => $c['id'],
            'message' => $c['title'] ?? ($c['message'] ?? ''),
            'author' => $c['author_name'] ?? null,
            'date' => $c['created_at'] ?? null,
        ], $data['commits'] ?? []);
        // GitLab compare API may include diffs elsewhere; omit files if not present
        return ['commits' => $commits];
    }

    public function getRepositoryUrl(): string
    {
        $base = $this->integration->base_url ?: 'https://gitlab.com';
        return rtrim($base, '/') . '/' . $this->integration->repo;
    }

    public function listPotentialReviewers(int $page = 1, int $perPage = 50): array
    {
        try {
            [$data, $headers] = $this->request('GET', '/members/all?per_page=' . $perPage . '&page=' . $page);
            $items = array_map(fn ($u) => ['username' => $u['username'], 'name' => $u['name'] ?? null], $data);
            return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
        } catch (GuzzleException $e) {
            throw $e;
        }
    }

    public function requestReviewers(int|string $number, array $usernames): array
    {
        // Map usernames to user IDs from members list (first page large perPage to minimize misses)
        [$members] = $this->request('GET', '/members/all?per_page=100');
        $ids = [];
        $lower = array_map('strtolower', $usernames);
        foreach ($members as $m) {
            if (in_array(strtolower($m['username']), $lower, true)) {
                $ids[] = $m['id'];
            }
        }
        // Update MR reviewers (GitLab supports reviewers as array of user IDs)
        $this->api('PUT', '/merge_requests/' . urlencode((string) $number), ['form_params' => ['reviewer_ids' => $ids]]);
        return ['status' => 'ok', 'added' => $usernames];
    }

    public function getPullStatuses(int|string $number): array
    {
        $mr = $this->api('GET', '/merge_requests/' . urlencode((string) $number));
        $sha = $mr['sha'] ?? ($mr['diff_refs']['head_sha'] ?? null);
        $statuses = [];
        if ($sha) {
            [$data] = $this->request('GET', '/repository/commits/' . urlencode($sha) . '/statuses');
            foreach ($data as $s) {
                $statuses[] = [
                    'context' => $s['name'] ?? 'status',
                    'state' => $s['status'] ?? 'pending',
                    'description' => $s['description'] ?? null,
                    'url' => $s['target_url'] ?? null,
                ];
            }
        }
        return ['sha' => $sha, 'statuses' => $statuses];
    }

    public function listIssueComments(int|string $issueId, int $page = 1, int $perPage = 20): array
    {
        [$data, $headers] = $this->request('GET', '/issues/' . urlencode((string) $issueId) . '/notes?per_page=' . $perPage . '&page=' . $page);
        $items = array_map(fn ($n) => [
            'id' => $n['id'],
            'user' => $n['author']['username'] ?? null,
            'body' => $n['body'] ?? '',
            'created_at' => $n['created_at'] ?? '',
        ], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function createIssueComment(int|string $issueId, string $body): array
    {
        $data = $this->api('POST', '/issues/' . urlencode((string) $issueId) . '/notes', ['form_params' => ['body' => $body]]);
        return ['id' => $data['id'] ?? 0, 'url' => $data['web_url'] ?? null];
    }
}
