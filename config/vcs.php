<?php

return [
    // TTL in seconds for read-only VCS responses (branches, commits, issues, pulls, stats, etc.)
    // Set VCS_CACHE_TTL in your .env to override. Recommended 120–300 seconds.
    'cache_ttl' => (int) env('VCS_CACHE_TTL', 120),
];

