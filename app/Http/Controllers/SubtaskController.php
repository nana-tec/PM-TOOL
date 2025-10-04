<?php

namespace App\Http\Controllers;

use App\Enums\Complexity;
use App\Enums\Priority;
use App\Models\Project;
use App\Models\Subtask;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubtaskController extends Controller
{
    public function index(Project $project, Task $task): JsonResponse
    {
        $this->authorize('viewAny', [Task::class, $project]);

        $items = $task->subtasks()->with(['assignedToUser:id,name,avatar'])->orderBy('order_column')->get();

        return response()->json(['subtasks' => $items]);
    }

    public function store(Request $request, Project $project, Task $task): JsonResponse
    {
        $this->authorize('create', [Task::class, $project]);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'assigned_to_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'description' => ['nullable', 'string'],
            'due_on' => ['nullable', 'date'],
            'estimation' => ['nullable', 'numeric', 'min:0'],
            'priority' => ['nullable', 'string', 'in:'.implode(',', array_column(Priority::cases(), 'value'))],
            'complexity' => ['nullable', 'string', 'in:'.implode(',', array_column(Complexity::cases(), 'value'))],
        ]);

        $subtask = $task->subtasks()->create([
            'created_by_user_id' => auth()->id(),
            'assigned_to_user_id' => $data['assigned_to_user_id'] ?? null,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'due_on' => $data['due_on'] ?? null,
            'estimation' => $data['estimation'] ?? null,
            'priority' => $data['priority'] ?? null,
            'complexity' => $data['complexity'] ?? null,
            'order_column' => $task->subtasks()->count(),
            'completed_at' => null,
        ]);

        return response()->json(['subtask' => $subtask->load('assignedToUser:id,name,avatar')], 201);
    }
}

