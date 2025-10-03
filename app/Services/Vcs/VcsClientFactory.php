<?php

namespace App\Services\Vcs;

use App\Models\ProjectVcsIntegration;
use GuzzleHttp\Client;
use InvalidArgumentException;

class VcsClientFactory
{
    public static function make(ProjectVcsIntegration $integration, ?string $overrideToken = null): VcsClientInterface
    {
        $provider = strtolower($integration->provider);
        $http = new Client([
            'timeout' => 15,
        ]);
        $token = $overrideToken ?: $integration->token;

        return match ($provider) {
            'github' => new VcsGithubClient($http, $integration, $token),
            'gitlab' => new VcsGitlabClient($http, $integration, $token),
            default => throw new InvalidArgumentException('Unsupported VCS provider: '.$integration->provider),
        };
    }
}
