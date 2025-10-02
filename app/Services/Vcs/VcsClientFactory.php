<?php

namespace App\Services\Vcs;

use App\Models\ProjectVcsIntegration;
use GuzzleHttp\Client;
use InvalidArgumentException;

class VcsClientFactory
{
    public static function make(ProjectVcsIntegration $integration): VcsClientInterface
    {
        $provider = strtolower($integration->provider);
        $http = new Client([
            'timeout' => 15,
        ]);
        return match ($provider) {
            'github' => new VcsGithubClient($http, $integration),
            'gitlab' => new VcsGitlabClient($http, $integration),
            default => throw new InvalidArgumentException('Unsupported VCS provider: ' . $integration->provider),
        };
    }
}
