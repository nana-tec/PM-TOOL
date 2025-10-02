<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectVcsIntegration extends Model
{
    protected $fillable = [
        'project_id',
        'provider',
        'repo',
        'base_url',
        'default_branch',
        'token',
    ];

    protected $hidden = [
        'token',
    ];

    protected $casts = [
        'token' => 'encrypted',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    protected function maskedToken(): Attribute
    {
        return Attribute::make(
            get: function () {
                // we don't have plaintext here due to encryption cast; just indicate presence
                return $this->attributes['token'] ? '********' : null;
            }
        );
    }
}

