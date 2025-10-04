<?php

namespace App\Http\Controllers;

use App\Http\Requests\SubTask\StoreSubTaskRequest;
use App\Http\Requests\SubTask\UpdateSubTaskRequest;
use App\Models\Project;
use App\Models\SubTask;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubTaskController extends Controller
{
    protected function normalizeParentId(Task $task, ?int $parentId): ?int
    {
        if (! $parentId) {
            return null;
        }
        $exists = SubTask::where('task_id', $task->id)->where('id', $parentId)->exists();
        return $exists ? $parentId : null;
    }

    protected function isDescendant(Task $task, int $candidateParentId, int $childId): bool
    {
        // climb up from candidateParentId to root and see if we encounter childId
        $guard = 0;
        $current = $candidateParentId;
        while ($current !== null && $guard++ < 1000) {
            $row = SubTask::where('task_id', $task->id)->where('id', $current)->first(['parent_id']);
            if (! $row) break;
            if ($current === $childId) return true;
            $current = $row->parent_id ? (int) $row->parent_id : null;
        }
        return false;
    }

    public function index(Project $project, Task $task): JsonResponse
    {
        $this->authorize('viewAny', [Task::class, $project]);

        $subtasks = $task->allSubTasks()->with('assignedToUser:id,name,avatar')->get();

        return response()->json(['subtasks' => $subtasks]);
    }

    public function store(StoreSubTaskRequest $request, Project $project, Task $task): JsonResponse
    {
        $this->authorize('update', [$task, $project]);

        $data = $request->validated();
        $data['parent_id'] = $this->normalizeParentId($task, $data['parent_id'] ?? null);

        $subtask = $task->allSubTasks()->create($data);

        return response()->json(['subtask' => $subtask->load('assignedToUser:id,name,avatar')]);
    }

    public function update(UpdateSubTaskRequest $request, Project $project, Task $task, SubTask $subtask): JsonResponse
    {
        $this->authorize('update', [$task, $project]);

        abort_if($subtask->task_id !== $task->id, 404);

        $data = $request->validated();
        if (array_key_exists('parent_id', $data)) {
            $data['parent_id'] = $this->normalizeParentId($task, $data['parent_id']);
            if (($data['parent_id'] ?? null) === $subtask->id) {
                $data['parent_id'] = null; // disallow self as parent
            }
            if (($data['parent_id'] ?? null) !== null && $this->isDescendant($task, (int) $data['parent_id'], $subtask->id)) {
                return response()->json([
                    'message' => 'Invalid parent: would create a cycle (parent is a descendant of the node).',
                    'errors' => ['parent_id' => ['Parent cannot be a descendant of the subtask.']],
                ], 422);
            }
        }

        $subtask->update($data);

        return response()->json(['subtask' => $subtask->fresh()->load('assignedToUser:id,name,avatar')]);
    }

    public function reorder(Request $request, Project $project, Task $task): JsonResponse
    {
        $this->authorize('update', [$task, $project]);

        // Expecting payload: [{id, parent_id, order_column}, ...]
        $items = $request->input('items', []);

        foreach ($items as $item) {
            $id = (int) ($item['id'] ?? 0);
            if (! $id) continue;

            $parentId = $this->normalizeParentId($task, isset($item['parent_id']) ? (int) $item['parent_id'] : null);
            if ($parentId === $id) { $parentId = null; } // disallow self as parent
            if ($parentId !== null && $this->isDescendant($task, $parentId, $id)) {
                $parentId = null; // sanitize to prevent cycles
            }
            $order = (int) ($item['order_column'] ?? 0);

            SubTask::where('task_id', $task->id)
                ->where('id', $id)
                ->update([
                    'parent_id' => $parentId,
                    'order_column' => $order,
                ]);
        }

        return response()->json();
    }

    public function destroy(Project $project, Task $task, SubTask $subtask): JsonResponse
    {
        $this->authorize('update', [$task, $project]);

        abort_if($subtask->task_id !== $task->id, 404);

        $subtask->delete();

        return response()->json();
    }
}
