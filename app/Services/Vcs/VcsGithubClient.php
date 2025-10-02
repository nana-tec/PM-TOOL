<?php

namespace App\Services\Vcs;

use App\Models\ProjectVcsIntegration;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class VcsGithubClient implements VcsClientInterface
{
    public function __construct(private Client $http, private ProjectVcsIntegration $integration) {}

    private function headers(): array
    {
        return [
            'Accept' => 'application/vnd.github+json',
            'Authorization' => 'token '.$this->integration->token,
        ];
    }

    private function api(string $method, string $path, array $options = []): array
    {
        $url = rtrim('https://api.github.com', '/').'/repos/'.$this->integration->repo.$path;
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
        $data = $this->api('GET', '/branches');

        return array_map(fn ($b) => ['name' => $b['name'], 'commit_sha' => $b['commit']['sha'] ?? null], $data);
    }

    public function listCommits(string $branch, int $perPage = 20): array
    {
        $data = $this->api('GET', '/commits?sha='.urlencode($branch).'&per_page='.$perPage);

        return array_map(function ($c) {
            return [
                'sha' => $c['sha'],
                'message' => $c['commit']['message'] ?? '',
                'author' => $c['commit']['author']['name'] ?? null,
                'date' => $c['commit']['author']['date'] ?? null,
                'url' => $c['html_url'] ?? null,
            ];
        }, $data);
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
        $data = $this->api('PUT', '/pulls/'.urlencode((string) $number).'/merge', ['json' => []]);

        return ['merged' => (bool) ($data['merged'] ?? false), 'message' => $data['message'] ?? null];
    }

    public function listPullRequests(): array
    {
        $data = $this->api('GET', '/pulls');

        return array_map(fn ($p) => ['number' => $p['number'], 'title' => $p['title'], 'state' => $p['state'], 'url' => $p['html_url'] ?? null], $data);
    }

    public function listIssues(): array
    {
        $data = $this->api('GET', '/issues?state=open');

        return array_map(fn ($i) => ['id' => $i['number'] ?? $i['id'] ?? 0, 'title' => $i['title'], 'state' => $i['state'], 'url' => $i['html_url'] ?? null], $data);
    }

    public function getRepositoryUrl(): string
    {
        return 'https://github.com/'.$this->integration->repo;
    }
}
