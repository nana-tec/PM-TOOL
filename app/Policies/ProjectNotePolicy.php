<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\ProjectNote;
use App\Models\User;

class ProjectNotePolicy
{
    public function viewAny(User $user, Project $project): bool
    {
        return $user->hasPermissionTo('view notes') && $user->hasProjectAccess($project);
    }

    public function create(User $user, Project $project): bool
    {
        return $user->hasPermissionTo('create note') && $user->hasProjectAccess($project);
    }

    public function update(User $user, ProjectNote $note, Project $project): bool
    {
        return $user->hasPermissionTo('edit note') && $user->hasProjectAccess($project);
    }

    public function delete(User $user, ProjectNote $note, Project $project): bool
    {
        return $user->hasPermissionTo('delete note') && $user->hasProjectAccess($project);
    }
}
