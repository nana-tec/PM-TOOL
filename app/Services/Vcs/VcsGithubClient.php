<?php

namespace App\Services\Vcs;

use App\Models\ProjectVcsIntegration;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class VcsGithubClient implements VcsClientInterface
{
    public function __construct(private Client $http, private ProjectVcsIntegration $integration, private ?string $token = null)
    {
    }

    private function headers(): array
    {
        return [
            'Accept' => 'application/vnd.github+json',
            'Authorization' => 'token ' . ($this->token ?? $this->integration->token),
        ];
    }

    private function request(string $method, string $path, array $options = []): array
    {
        $url = rtrim('https://api.github.com', '/') . '/repos/' . $this->integration->repo . $path;
        $options['headers'] = ($options['headers'] ?? []) + $this->headers();
        $res = $this->http->request($method, $url, $options);
        $body = (string) $res->getBody();
        $data = $body !== '' ? json_decode($body, true) : [];
        $headers = $res->getHeaders();
        return [$data, $headers];
    }

    private function hasNextFromHeaders(array $headers): bool
    {
        $links = $headers['Link'][0] ?? '';
        return is_string($links) && str_contains($links, 'rel="next"');
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
        try {
            [$data, $headers] = $this->request('GET', '/branches?per_page=' . $perPage . '&page=' . $page);
            $items = array_map(fn ($b) => ['name' => $b['name'], 'commit_sha' => $b['commit']['sha'] ?? null], $data);
            return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
        } catch (GuzzleException $e) {
            throw $e;
        }
    }

    public function listCommits(string $branch, int $page = 1, int $perPage = 20): array
    {
        try {
            [$data, $headers] = $this->request('GET', '/commits?sha=' . urlencode($branch) . '&per_page=' . $perPage . '&page=' . $page);
            $items = array_map(function ($c) {
                return [
                    'sha' => $c['sha'],
                    'message' => $c['commit']['message'] ?? '',
                    'author' => $c['commit']['author']['name'] ?? null,
                    'date' => $c['commit']['author']['date'] ?? null,
                    'url' => $c['html_url'] ?? null,
                ];
            }, $data);
            return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
        } catch (GuzzleException $e) {
            throw $e;
        }
    }

    public function createIssue(string $title, ?string $body = null): array
    {
        $payload = ['json' => array_filter(['title' => $title, 'body' => $body], fn ($v) => $v !== null)];
        $data = $this->api('POST', '/issues', $payload);
        return ['id' => $data['number'] ?? $data['id'] ?? 0, 'url' => $data['html_url'] ?? null];
    }

    public function openMergeRequest(string $sourceBranch, string $targetBranch, string $title, ?string $body = null): array
    {
        $payload = ['json' => ['head' => $sourceBranch, 'base' => $targetBranch, 'title' => $title, 'body' => $body]];
        $data = $this->api('POST', '/pulls', $payload);
        return ['number' => $data['number'] ?? 0, 'url' => $data['html_url'] ?? null];
    }

    public function mergeRequest(int|string $number): array
    {
        $data = $this->api('PUT', '/pulls/' . urlencode((string) $number) . '/merge', ['json' => new \stdClass()]);
        return ['merged' => (bool) ($data['merged'] ?? false), 'message' => $data['message'] ?? null];
    }

    public function listPullRequests(string $state = 'open', int $page = 1, int $perPage = 20): array
    {
        if ($state === 'merged') {
            // GitHub has no 'merged' state in list; fetch closed and filter by merged_at
            [$data, $headers] = $this->request('GET', '/pulls?state=closed&per_page=' . $perPage . '&page=' . $page);
            $merged = [];
            foreach ($data as $p) {
                $detail = $this->api('GET', '/pulls/' . $p['number']);
                if (!empty($detail['merged_at'])) {
                    $merged[] = ['number' => $p['number'], 'title' => $p['title'], 'state' => 'merged', 'url' => $p['html_url'] ?? null];
                }
            }
            return ['items' => $merged, 'has_next' => $this->hasNextFromHeaders($headers)];
        }
        [$data, $headers] = $this->request('GET', '/pulls?state=' . urlencode($state) . '&per_page=' . $perPage . '&page=' . $page);
        $items = array_map(fn ($p) => ['number' => $p['number'], 'title' => $p['title'], 'state' => $p['state'], 'url' => $p['html_url'] ?? null], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function listIssues(string $state = 'open', int $page = 1, int $perPage = 20): array
    {
        [$data, $headers] = $this->request('GET', '/issues?state=' . urlencode($state) . '&per_page=' . $perPage . '&page=' . $page);
        // Pull requests also appear in issues; filter out PRs by presence of 'pull_request' key
        $data = array_values(array_filter($data, fn ($i) => !isset($i['pull_request'])));
        $items = array_map(fn ($i) => ['id' => $i['number'] ?? $i['id'] ?? 0, 'title' => $i['title'], 'state' => $i['state'], 'url' => $i['html_url'] ?? null], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function getPullRequest(int|string $number): array
    {
        $p = $this->api('GET', '/pulls/' . urlencode((string) $number));
        return [
            'number' => $p['number'],
            'title' => $p['title'],
            'state' => $p['state'],
            'mergeable' => $p['mergeable'] ?? null,
            'merged' => $p['merged'] ?? null,
            'requested_reviewers' => array_map(fn ($u) => $u['login'], $p['requested_reviewers'] ?? []),
            'url' => $p['html_url'] ?? null,
            'base' => $p['base']['ref'] ?? null,
            'head' => $p['head']['label'] ?? ($p['head']['ref'] ?? null),
        ];
    }

    public function listPullComments(int|string $number, int $page = 1, int $perPage = 20): array
    {
        [$data, $headers] = $this->request('GET', '/issues/' . urlencode((string) $number) . '/comments?per_page=' . $perPage . '&page=' . $page);
        $items = array_map(fn ($c) => [
            'id' => $c['id'],
            'user' => $c['user']['login'] ?? null,
            'body' => $c['body'] ?? '',
            'created_at' => $c['created_at'] ?? '',
        ], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function createPullComment(int|string $number, string $body): array
    {
        $data = $this->api('POST', '/issues/' . urlencode((string) $number) . '/comments', ['json' => ['body' => $body]]);
        return ['id' => $data['id'] ?? 0, 'url' => $data['html_url'] ?? null];
    }

    public function submitReview(int|string $number, string $event, ?string $body = null): array
    {
        $payload = ['json' => ['event' => $event, 'body' => $body]];
        $this->api('POST', '/pulls/' . urlencode((string) $number) . '/reviews', $payload);
        return ['status' => 'ok'];
    }

    public function compare(string $base, string $head): array
    {
        $data = $this->api('GET', '/compare/' . rawurlencode($base) . '...' . rawurlencode($head));
        $commits = array_map(fn ($c) => [
            'sha' => $c['sha'],
            'message' => $c['commit']['message'] ?? '',
            'author' => $c['commit']['author']['name'] ?? null,
            'date' => $c['commit']['author']['date'] ?? null,
        ], $data['commits'] ?? []);
        $files = array_map(fn ($f) => [
            'filename' => $f['filename'],
            'additions' => $f['additions'] ?? 0,
            'deletions' => $f['deletions'] ?? 0,
        ], $data['files'] ?? []);
        return ['commits' => $commits, 'files' => $files];
    }

    public function getRepositoryUrl(): string
    {
        return 'https://github.com/' . $this->integration->repo;
    }

    public function listPotentialReviewers(int $page = 1, int $perPage = 50): array
    {
        try {
            // Use collaborators as potential reviewers
            [$data, $headers] = $this->request('GET', '/collaborators?per_page=' . $perPage . '&page=' . $page);
            $items = array_map(fn ($u) => ['username' => $u['login'], 'name' => $u['name'] ?? null], $data);
            return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
        } catch (GuzzleException $e) {
            throw $e;
        }
    }

    public function requestReviewers(int|string $number, array $usernames): array
    {
        $payload = ['json' => ['reviewers' => array_values($usernames)]];
        $this->api('POST', '/pulls/' . urlencode((string) $number) . '/requested_reviewers', $payload);
        return ['status' => 'ok', 'added' => $usernames];
    }

    public function getPullStatuses(int|string $number): array
    {
        $pr = $this->api('GET', '/pulls/' . urlencode((string) $number));
        $sha = $pr['head']['sha'] ?? null;
        $statuses = [];
        if ($sha) {
            $res = $this->api('GET', '/commits/' . urlencode($sha) . '/status');
            foreach ($res['statuses'] ?? [] as $s) {
                $statuses[] = [
                    'context' => $s['context'] ?? 'status',
                    'state' => $s['state'] ?? 'pending',
                    'description' => $s['description'] ?? null,
                    'url' => $s['target_url'] ?? null,
                ];
            }
        }
        return ['sha' => $sha, 'statuses' => $statuses];
    }

    /**
     * Get required status check contexts for a branch (branch protection).
     * Returns an array of strings (contexts). If not protected or insufficient permissions, returns empty array.
     */
    public function getRequiredStatusContexts(string $branch): array
    {
        try {
            $data = $this->api('GET', '/branches/' . rawurlencode($branch) . '/protection/required_status_checks');
            $contexts = $data['contexts'] ?? [];
            if (!is_array($contexts)) return [];
            return array_values(array_unique(array_map('strval', $contexts)));
        } catch (\Throwable $e) {
            // Not protected or no permissions
            return [];
        }
    }

    public function listIssueComments(int|string $issueId, int $page = 1, int $perPage = 20): array
    {
        [$data, $headers] = $this->request('GET', '/issues/' . urlencode((string) $issueId) . '/comments?per_page=' . $perPage . '&page=' . $page);
        $items = array_map(fn ($c) => [
            'id' => $c['id'],
            'user' => $c['user']['login'] ?? null,
            'body' => $c['body'] ?? '',
            'created_at' => $c['created_at'] ?? '',
        ], $data);
        return ['items' => $items, 'has_next' => $this->hasNextFromHeaders($headers)];
    }

    public function createIssueComment(int|string $issueId, string $body): array
    {
        $data = $this->api('POST', '/issues/' . urlencode((string) $issueId) . '/comments', ['json' => ['body' => $body]]);
        return ['id' => $data['id'] ?? 0, 'url' => $data['html_url'] ?? null];
    }
}
