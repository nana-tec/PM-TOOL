<?php

namespace App\Services\Vcs;

interface VcsClientInterface
{
    /** @return array<int, array{name:string, commit_sha?:string}> */
    public function listBranches(): array;

    /**
     * @return array<int, array{sha:string, message:string, author?:string, date?:string, url?:string}>
     */
    public function listCommits(string $branch, int $perPage = 20): array;

    /** @return array{id:int|string, url?:string} */
    public function createIssue(string $title, ?string $body = null): array;

    /** @return array{number:int|string, url?:string} */
    public function openMergeRequest(string $sourceBranch, string $targetBranch, string $title, ?string $body = null): array;

    /** @return array{merged:bool, message?:string} */
    public function mergeRequest(int|string $number): array;

    /** @return array<int, array{number:int|string, title:string, state:string, url?:string}> */
    public function listPullRequests(): array;

    /** @return array<int, array{id:int|string, title:string, state:string, url?:string}> */
    public function listIssues(): array;

    public function getRepositoryUrl(): string;
}
