<?php

namespace App\Services\Vcs;

use App\Models\ProjectVcsIntegration;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class VcsGitlabClient implements VcsClientInterface
{
    public function __construct(private Client $http, private ProjectVcsIntegration $integration) {}

    private function baseApi(): string
    {
        $base = $this->integration->base_url ?: 'https://gitlab.com';

        return rtrim($base, '/').'/api/v4';
    }

    private function headers(): array
    {
        return [
            'Accept' => 'application/json',
            'PRIVATE-TOKEN' => $this->integration->token,
        ];
    }

    private function api(string $method, string $path, array $options = []): array
    {
        $projectId = rawurlencode($this->integration->repo); // repo stores path like group/project
        $url = $this->baseApi().'/projects/'.$projectId.$path;
        $options['headers'] = ($options['headers'] ?? []) + $this->headers();
        try {
            $res = $this->http->request($method, $url, $options);
            $body = (string) $res->getBody();

            return $body !== '' ? json_decode($body, true) : [];
        } catch (GuzzleException $e) {
            throw $e;
        }
    }

    public function listBranches(): array
    {
        $data = $this->api('GET', '/repository/branches');

        return array_map(fn ($b) => ['name' => $b['name'], 'commit_sha' => $b['commit']['id'] ?? null], $data);
    }

    public function listCommits(string $branch, int $perPage = 20): array
    {
        $data = $this->api('GET', '/repository/commits?ref_name='.urlencode($branch).'&per_page='.$perPage);

        return array_map(function ($c) {
            return [
                'sha' => $c['id'],
                'message' => $c['title'] ?? ($c['message'] ?? ''),
                'author' => $c['author_name'] ?? null,
                'date' => $c['created_at'] ?? null,
                'url' => $c['web_url'] ?? null,
            ];
        }, $data);
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
        $data = $this->api('PUT', '/merge_requests/'.urlencode((string) $number).'/merge', ['form_params' => []]);
        $merged = isset($data['merged']) ? (bool) $data['merged'] : (($data['state'] ?? '') === 'merged');

        return ['merged' => $merged, 'message' => $data['message'] ?? null];
    }

    public function listPullRequests(): array
    {
        $data = $this->api('GET', '/merge_requests?state=opened');

        return array_map(fn ($m) => ['number' => $m['iid'], 'title' => $m['title'], 'state' => $m['state'], 'url' => $m['web_url'] ?? null], $data);
    }

    public function listIssues(): array
    {
        $data = $this->api('GET', '/issues?state=opened');

        return array_map(fn ($i) => ['id' => $i['iid'] ?? $i['id'] ?? 0, 'title' => $i['title'], 'state' => $i['state'], 'url' => $i['web_url'] ?? null], $data);
    }

    public function getRepositoryUrl(): string
    {
        $base = $this->integration->base_url ?: 'https://gitlab.com';

        return rtrim($base, '/').'/'.$this->integration->repo;
    }
}
