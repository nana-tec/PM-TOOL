<?php

namespace App\Http\Controllers;

use App\Actions\Task\CreateTask;
use App\Actions\Task\UpdateTask;
use App\Enums\PricingType;
use App\Events\Task\TaskDeleted;
use App\Events\Task\TaskGroupChanged;
use App\Events\Task\TaskOrderChanged;
use App\Events\Task\TaskRestored;
use App\Events\Task\TaskUpdated;
use App\Http\Requests\Task\StoreTaskRequest;
use App\Http\Requests\Task\UpdateTaskRequest;
use App\Models\Label;
use App\Models\OwnerCompany;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskGroup;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    public function index(Request $request, Project $project, ?Task $task = null): Response
    {
        $this->authorize('viewAny', [Task::class, $project]);

        $groups = $project
            ->taskGroups()
            ->when($request->has('archived'), fn ($query) => $query->onlyArchived())
            ->get();

        $groupedTasks = $project
            ->taskGroups()
            ->with(['project' => fn ($query) => $query->withArchived()])
            ->get()
            ->mapWithKeys(function (TaskGroup $group) use ($request, $project) {
                return [
                    $group->id => Task::where('project_id', $project->id)
                        ->where('group_id', $group->id)
                        ->roots()
                        ->searchByQueryString()
                        ->filterByQueryString()
                        ->when($request->user()->hasRole('client'), fn ($query) => $query->where('hidden_from_clients', false))
                        ->when($request->has('archived'), fn ($query) => $query->onlyArchived())
                        ->when(! $request->has('status'), fn ($query) => $query->whereNull('completed_at'))
                        ->withDefault()
                        ->when($project->isArchived(), fn ($query) => $query->with(['project' => fn ($query) => $query->withArchived()]))
                        ->get(),
                ];
            });

        // Provide flat list of tasks for parent picker (exclude archived by default)
        $tasksForParentPicker = Task::where('project_id', $project->id)
            ->when($project->isArchived(), fn ($query) => $query->with(['project' => fn ($q) => $q->withArchived()]))
            ->get(['id', 'name', 'number']);

        $openedTask = null;
        if ($task) {
            $openedTask = $task->loadDefault()->load(['children' => function ($q) {
                $q->orderBy('order_column');
            }]);
        }

        return Inertia::render('Projects/Tasks/Index', [
            'project' => $project,
            'usersWithAccessToProject' => PermissionService::usersWithAccessToProject($project),
            'labels' => Label::get(['id', 'name', 'color']),
            'taskGroups' => $groups,
            'groupedTasks' => $groupedTasks,
            'openedTask' => $openedTask,
            'currency' => [
                'symbol' => OwnerCompany::with('currency')->first()->currency->symbol,
            ],
            'tasksForParentPicker' => $tasksForParentPicker,
        ]);
    }

    public function store(StoreTaskRequest $request, Project $project): RedirectResponse|JsonResponse
    {
        $this->authorize('create', [Task::class, $project]);

        $task = (new CreateTask)->create($project, $request->validated());

        if ($request->expectsJson() || $request->wantsJson() || $request->ajax()) {
            return response()->json(['task' => $task->loadDefault()], 201);
        }

        return redirect()->route('projects.tasks', $project)->success('Task added', 'A new task was successfully added.');
    }

    public function update(UpdateTaskRequest $request, Project $project, Task $task): JsonResponse
    {
        $this->authorize('update', [$task, $project]);

        (new UpdateTask)->update($task, $request->validated());

        return response()->json();
    }

    public function reorder(Request $request, Project $project): JsonResponse
    {
        $this->authorize('reorder', [Task::class, $project]);

        Task::setNewOrder($request->ids);

        TaskOrderChanged::dispatch(
            $project->id,
            $request->group_id,
            $request->from_index,
            $request->to_index,
        );

        return response()->json();
    }

    public function move(Request $request, Project $project): JsonResponse
    {
        $this->authorize('reorder', [Task::class, $project]);

        Task::setNewOrder($request->ids);
        Task::whereIn('id', $request->ids)->update(['group_id' => $request->to_group_id]);

        TaskGroupChanged::dispatch(
            $project->id,
            $request->from_group_id,
            $request->to_group_id,
            $request->from_index,
            $request->to_index,
        );

        return response()->json();
    }

    public function complete(Request $request, Project $project, Task $task): JsonResponse
    {
        $this->authorize('complete', [Task::class, $project]);

        $task->update([
            'completed_at' => ($request->completed === true) ? now() : null,
        ]);
        TaskUpdated::dispatch($task, 'completed_at');

        return response()->json();
    }

    public function destroy(Project $project, Task $task): RedirectResponse
    {
        $this->authorize('archive task', [$task, $project]);

        $task->archive();
        TaskDeleted::dispatch($task->id, $task->project_id);

        return redirect()->back()->success('Task archived', 'The task was successfully archived.');
    }

    public function restore(Project $project, Task $task)
    {

        $this->authorize('restore', [$task, $project]);

        $task->unArchive();
        TaskRestored::dispatch($task);

        return redirect()->back()->success('Task restored', 'The restoring of the Task was completed successfully.');
    }

    public function history(Project $project, Task $task): JsonResponse
    {
        $this->authorize('viewAny', [Task::class, $project]);

        $audits = $task->audits()
            ->latest()
            ->get(['id', 'event', 'old_values', 'new_values', 'created_at']);

        return response()->json(['history' => $audits]);
    }

    public function restoreHistory(Request $request, Project $project, Task $task, int $auditId): JsonResponse
    {
        $this->authorize('update', [$task, $project]);

        $audit = $task->audits()->where('id', $auditId)->firstOrFail();

        $payload = $audit->new_values ?: $audit->old_values ?: [];

        // Only allow restoring safe, fillable attributes
        $allowed = [
            'name',
            'description',
            'due_on',
            'estimation',
            'assigned_to_user_id',
            'pricing_type',
            'fixed_price',
            'hidden_from_clients',
            'billable',
            'group_id',
            'completed_at',
            'parent_id',
            'priority',
            'complexity',
        ];

        $data = collect($payload)
            ->only($allowed)
            ->toArray();

        // If a subset of fields is requested, filter the data
        $requestedFields = $request->input('fields');
        if (is_array($requestedFields) && ! empty($requestedFields)) {
            $requestedFields = array_values(array_intersect($requestedFields, $allowed));
            $data = array_intersect_key($data, array_flip($requestedFields));
        }

        // Normalize pricing_type case: if hourly then fixed_price must be null
        if (array_key_exists('pricing_type', $data)) {
            $pricing = $data['pricing_type'];
            $pricingValue = $pricing instanceof PricingType ? $pricing->value : (string) $pricing;
            if ($pricingValue === PricingType::HOURLY->value) {
                $data['fixed_price'] = null;
            }
        }

        if (! empty($data)) {
            $updater = new UpdateTask;
            foreach ($data as $field => $value) {
                $updater->update($task, [$field => $value]);
            }
        }

        return response()->json(['task' => $task->refresh()->loadDefault()]);
    }

    public function subtasks(Project $project, Task $task): JsonResponse
    {
        $this->authorize('viewAny', [Task::class, $project]);

        $children = $task->children()
            ->orderBy('order_column')
            ->withDefault()
            ->get();

        return response()->json(['subtasks' => $children]);
    }
}
