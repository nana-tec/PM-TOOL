<?php

namespace App\Http\Controllers\Project;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProjectNote\StoreProjectNoteRequest;
use App\Models\Project;
use App\Models\ProjectNote;

class NoteController extends Controller
{
    public function index(Project $project)
    {
        $this->authorize('viewAny', [ProjectNote::class, $project]);

        return response()->json(
            $project->notes()->with(['user:id,name,avatar,job_title'])->latest()->get(),
        );
    }

    public function store(StoreProjectNoteRequest $request, Project $project)
    {
        $this->authorize('create', [ProjectNote::class, $project]);

        $note = $project->notes()->create(
            $request->validated() + ['user_id' => auth()->id()]
        );

        return response()->json(['note' => $note->load(['user:id,name,avatar,job_title'])]);
    }
}

