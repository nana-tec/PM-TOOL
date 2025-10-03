<?php

namespace App\Services\Vcs;

interface VcsClientInterface
{
    /** @return array{items: array<int, array{name:string, commit_sha?:string}>, has_next: bool} */
    public function listBranches(int $page = 1, int $perPage = 30): array;

    /**
     * @return array{items: array<int, array{sha:string, message:string, author?:string, date?:string, url?:string}>, has_next: bool}
     */
    public function listCommits(string $branch, int $page = 1, int $perPage = 20): array;

    /** @return array{id:int|string, url?:string} */
    public function createIssue(string $title, ?string $body = null): array; // not paginated

    /**
     * Open a PR/MR.
     * Options may include provider-specific flags like ['draft' => true].
     *
     * @return array{number:int|string, url?:string}
     */
    public function openMergeRequest(string $sourceBranch, string $targetBranch, string $title, ?string $body = null, array $options = []): array;

    /**
     * Merge a PR/MR.
     * Provider may support strategies like 'merge' | 'squash' | 'rebase'.
     *
     * @return array{merged:bool, message?:string}
     */
    public function mergeRequest(int|string $number, ?string $strategy = null): array;

    /** @return array{items: array<int, array{number:int|string, title:string, state:string, url?:string}>, has_next: bool} */
    public function listPullRequests(string $state = 'open', int $page = 1, int $perPage = 20): array;

    /** @return array{items: array<int, array{id:int|string, title:string, state:string, url?:string}>, has_next: bool} */
    public function listIssues(string $state = 'open', int $page = 1, int $perPage = 20): array;

    /** @return array{number:int|string, title:string, state:string, mergeable?:bool|null, merged?:bool|null, requested_reviewers?:array, url?:string, base?:string|null, head?:string|null, draft?:bool|null} */
    public function getPullRequest(int|string $number): array;

    /** @return array{items: array<int, array{id:int|string, user?:string, body:string, created_at:string}>, has_next: bool} */
    public function listPullComments(int|string $number, int $page = 1, int $perPage = 20): array;

    /** @return array{id:int|string, url?:string} */
    public function createPullComment(int|string $number, string $body): array;

    /** @return array{status:string, message?:string} */
    public function submitReview(int|string $number, string $event, ?string $body = null): array; // event: APPROVE|REQUEST_CHANGES|COMMENT

    /** @return array{commits: array<int, array{sha:string, message:string, author?:string, date?:string}>, files?: array<int, array{filename:string, additions:int, deletions:int}>} */
    public function compare(string $base, string $head): array;

    public function getRepositoryUrl(): string;

    /** @return array{items: array<int, array{username:string, name?:string}>, has_next: bool} */
    public function listPotentialReviewers(int $page = 1, int $perPage = 50): array;

    /** @return array{status:string, added?:array} */
    public function requestReviewers(int|string $number, array $usernames): array;

    /**
     * Returns head SHA and mixed status list (classic statuses + check runs as normalized entries).
     *
     * @return array{sha?:string, statuses: array<int, array{context:string, state:string, description?:string, url?:string}>}
     */
    public function getPullStatuses(int|string $number): array;

    /** @return array{items: array<int, array{id:int|string, user?:string, body:string, created_at:string}>, has_next: bool} */
    public function listIssueComments(int|string $issueId, int $page = 1, int $perPage = 20): array;

    /** @return array{id:int|string, url?:string} */
    public function createIssueComment(int|string $issueId, string $body): array;

    /**
     * List inline/file-level review comments on a PR/MR.
     *
     * @return array{items: array<int, array{id:int|string, thread_id:int|string, path?:string|null, line?:int|null, user?:string|null, body:string, created_at:string}>, has_next: bool}
     */
    public function listPullReviewComments(int|string $number, int $page = 1, int $perPage = 50): array;

    /**
     * Reply to an existing inline/file-level review comment thread.
     *
     * @return array{status:string}
     */
    public function replyPullReviewComment(int|string $number, int|string $threadId, string $body): array;
}
