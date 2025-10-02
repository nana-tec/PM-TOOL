<?php

namespace App\Observers;

use App\Models\ProjectNote;

class ProjectNoteObserver
{
    public function created(ProjectNote $note): void
    {
        $note->activities()->create([
            'project_id' => $note->project_id,
            'user_id' => auth()->id(),
            'title' => 'New note',
            'subtitle' => auth()->user()->name." added a note to \"{$note->project->name}\"",
        ]);
    }
}
