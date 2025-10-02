<?php

namespace App\Http\Controllers\Task;

use App\Events\Task\TimeLogCreated;
use App\Events\Task\TimeLogDeleted;
use App\Http\Controllers\Controller;
use App\Http\Requests\TimeLog\StoreTimeLogRequest;
use App\Models\Project;
use App\Models\Task;
use App\Models\TimeLog;
use Illuminate\Http\JsonResponse;

class TimeLogController extends Controller
{
    public function startTimer(Project $project, Task $task): JsonResponse
    {
        $this->authorize('create', [TimeLog::class, $project]);

        // If user already has a running timer on this task, return it (idempotent)
        $existing = $task->timeLogs()
            ->where('user_id', auth()->id())
            ->whereNull('minutes')
            ->whereNotNull('timer_start')
            ->whereNull('timer_stop')
            ->latest('id')
            ->first();

        if ($existing) {
            return response()->json(['timeLog' => $existing->load(['user:id,name'])]);
        }

        $timeLog = $task->timeLogs()->create([
            'user_id' => auth()->id(),
            'minutes' => null,
            'timer_start' => now()->timestamp,
        ]);

        // Broadcast creation so other clients can see the running timer
        TimeLogCreated::dispatch($task, $timeLog);

        return response()->json(['timeLog' => $timeLog->load(['user:id,name'])]);
    }

    public function stopTimer(Project $project, Task $task, TimeLog $timeLog): JsonResponse
    {
        $this->authorize('create', [TimeLog::class, $project]);

        // Ensure the time log belongs to the task and current user
        abort_unless($timeLog->task_id === $task->id, 404);
        abort_unless($timeLog->user_id === auth()->id(), 403);

        // Only stop a running timer
        abort_if(!is_null($timeLog->minutes), 422, 'Timer already stopped');

        $timeLog->update([
            'timer_stop' => now()->timestamp,
            'minutes' => round((now()->timestamp - $timeLog->timer_start) / 60),
        ]);

        TimeLogCreated::dispatch($task, $timeLog);

        return response()->json(['timeLog' => $timeLog->load(['user:id,name'])]);
    }

    public function store(StoreTimeLogRequest $request, Project $project, Task $task): JsonResponse
    {
        $this->authorize('create', [TimeLog::class, $project]);

        $timeLog = $task->timeLogs()->create(
            $request->validated() + ['user_id' => auth()->id()]
        );

        TimeLogCreated::dispatch($task, $timeLog);

        return response()->json(['timeLog' => $timeLog->load(['user:id,name'])]);
    }

    public function destroy(Project $project, Task $task, TimeLog $timeLog): JsonResponse
    {
        $this->authorize('delete', [$timeLog, $project]);

        // Ensure the time log belongs to the task and is owned by the current user
        abort_unless($timeLog->task_id === $task->id, 404);
        abort_unless($timeLog->user_id === auth()->id(), 403);

        $timeLog->delete();

        TimeLogDeleted::dispatch($task, $timeLog->id);

        return response()->json();
    }
}
