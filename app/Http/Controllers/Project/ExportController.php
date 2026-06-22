<?php

namespace App\Http\Controllers\Project;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function csv(Project $project): StreamedResponse
    {
        $this->authorize('view', $project);

        $projectIds = array_merge([$project->id], $project->allDescendantIds());

        $tasks = Task::whereIn('project_id', $projectIds)
            ->with(['assignedToUser:id,name', 'labels:id,name,color', 'taskGroup:id,name'])
            ->orderBy('completed_at')
            ->orderBy('due_on')
            ->get();

        $completed = $tasks->whereNotNull('completed_at');
        $pending = $tasks->whereNull('completed_at');

        $callback = function () use ($project, $tasks, $completed, $pending) {
            $file = fopen('php://output', 'w');

            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($file, ['Project Export', '']);
            fputcsv($file, ['Project', $project->name]);
            fputcsv($file, ['Description', $project->description ?? '']);
            fputcsv($file, ['Total Tasks', $tasks->count()]);
            fputcsv($file, ['Completed', $completed->count()]);
            fputcsv($file, ['Pending', $pending->count()]);
            fputcsv($file, ['']);

            fputcsv($file, ['ID', 'Name', 'Status', 'Priority', 'Assignee', 'Group', 'Due Date', 'Completed At', 'Labels', 'Estimation (hrs)']);

            foreach ($tasks as $task) {
                fputcsv($file, [
                    $task->number,
                    $task->name,
                    $task->completed_at ? 'Completed' : 'Pending',
                    $task->priority?->value ?? '',
                    $task->assignedToUser?->name ?? '',
                    $task->taskGroup?->name ?? '',
                    $task->due_on?->format('Y-m-d') ?? '',
                    $task->completed_at?->format('Y-m-d H:i') ?? '',
                    $task->labels->pluck('name')->implode('; '),
                    $task->estimation ?? '',
                ]);
            }

            fclose($file);
        };

        return new StreamedResponse($callback, 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="' . str_replace('"', '', $project->name) . '-tasks.csv"',
        ]);
    }

    public function pdf(Project $project)
    {
        $this->authorize('view', $project);

        $projectIds = array_merge([$project->id], $project->allDescendantIds());

        $project->load(['clientCompany:id,name']);

        $tasks = Task::whereIn('project_id', $projectIds)
            ->with(['assignedToUser:id,name', 'labels:id,name,color', 'taskGroup:id,name'])
            ->orderBy('completed_at')
            ->orderBy('due_on')
            ->get();

        return Inertia::render('Projects/ExportPdf', [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'description' => $project->description,
                'client_company' => $project->clientCompany?->only(['id', 'name']),
            ],
            'tasks' => $tasks->map(fn ($task) => [
                'id' => $task->id,
                'number' => $task->number,
                'name' => $task->name,
                'status' => $task->completed_at ? 'Completed' : 'Pending',
                'priority' => $task->priority?->value ?? '',
                'assignee' => $task->assignedToUser?->name ?? '',
                'group' => $task->taskGroup?->name ?? '',
                'due_on' => $task->due_on?->format('Y-m-d') ?? '',
                'completed_at' => $task->completed_at?->format('Y-m-d H:i') ?? '',
                'labels' => $task->labels->pluck('name')->implode(', '),
                'estimation' => $task->estimation ?? '',
            ]),
            'stats' => [
                'total' => $tasks->count(),
                'completed' => $tasks->whereNotNull('completed_at')->count(),
                'pending' => $tasks->whereNull('completed_at')->count(),
            ],
        ]);
    }
}
