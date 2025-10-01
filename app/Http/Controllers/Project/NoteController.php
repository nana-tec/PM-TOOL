<?php

namespace App\Http\Controllers\Project;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProjectNote\StoreProjectNoteRequest;
use App\Http\Requests\ProjectNote\UpdateProjectNoteRequest;
use App\Models\Project;
use App\Models\ProjectNote;
use App\Services\HtmlSanitizer;
use Illuminate\Http\Request;
use OwenIt\Auditing\Models\Audit;

class NoteController extends Controller
{
    public function index(Project $project)
    {
        $this->authorize('viewAny', [ProjectNote::class, $project]);

        $perPage = (int) request('per_page', 10);
        $notes = $project->notes()
            ->with(['user:id,name,avatar,job_title'])
            ->latest()
            ->paginate($perPage);

        $user = auth()->user();

        return response()->json([
            'notes' => $notes->items(),
            'meta' => [
                'current_page' => $notes->currentPage(),
                'last_page' => $notes->lastPage(),
                'per_page' => $notes->perPage(),
                'total' => $notes->total(),
            ],
            'can' => [
                'create' => $user->hasPermissionTo('create note') && $user->hasProjectAccess($project),
                'edit' => $user->hasPermissionTo('edit note') && $user->hasProjectAccess($project),
                'delete' => $user->hasPermissionTo('delete note') && $user->hasProjectAccess($project),
            ],
        ]);
    }

    public function store(StoreProjectNoteRequest $request, Project $project)
    {
        $this->authorize('create', [ProjectNote::class, $project]);

        $sanitized = app(HtmlSanitizer::class)->sanitize($request->validated()['content'] ?? '');

        $note = $project->notes()->create([
            'user_id' => auth()->id(),
            'content' => $sanitized,
        ]);

        return response()->json(['note' => $note->load(['user:id,name,avatar,job_title'])]);
    }

    public function update(UpdateProjectNoteRequest $request, Project $project, ProjectNote $note)
    {
        $this->authorize('update', [$note, $project]);

        $sanitized = app(HtmlSanitizer::class)->sanitize($request->validated()['content'] ?? '');

        $note->update(['content' => $sanitized]);

        return response()->json(['note' => $note->refresh()->load(['user:id,name,avatar,job_title'])]);
    }

    public function destroy(Project $project, ProjectNote $note)
    {
        $this->authorize('delete', [$note, $project]);

        $note->delete();

        return response()->json();
    }

    public function history(Project $project, ProjectNote $note)
    {
        $this->authorize('viewAny', [ProjectNote::class, $project]);

        $audits = $note->audits()
            ->latest()
            ->get(['id', 'event', 'old_values', 'new_values', 'created_at']);

        return response()->json(['history' => $audits]);
    }

    public function restore(Project $project, ProjectNote $note, int $auditId)
    {
        $this->authorize('update', [$note, $project]);

        $audit = $note->audits()->where('id', $auditId)->firstOrFail();

        $target = $audit->new_values['content'] ?? ($audit->old_values['content'] ?? '');
        $sanitized = app(HtmlSanitizer::class)->sanitize($target);

        $note->update(['content' => $sanitized]);

        return response()->json(['note' => $note->refresh()->load(['user:id,name,avatar,job_title'])]);
    }
}
