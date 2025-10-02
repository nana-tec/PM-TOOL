<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $projectIds = PermissionService::projectsThatUserCanAccess(auth()->user())->pluck('id');

        // Team capacity summary for dashboard
        $capacityData = null;
        if (auth()->user()->can('view team capacity report')) {
            $capacityData = $this->getCapacitySummary();
        }

        return Inertia::render('Dashboard/Index', [
            'projects' => Project::whereIn('id', $projectIds)
                ->with([
                    'clientCompany:id,name',
                ])
                ->withCount([
                    'tasks AS all_tasks_count',
                    'tasks AS completed_tasks_count' => fn ($query) => $query->whereNotNull('completed_at'),
                    'tasks AS overdue_tasks_count' => fn ($query) => $query->whereNull('completed_at')->whereDate('due_on', '<', now()),
                ])
                ->withExists('favoritedByAuthUser AS favorite')
                ->orderBy('favorite', 'desc')
                ->orderBy('name', 'asc')
                ->get(['id', 'name']),
            'overdueTasks' => Task::whereIn('project_id', $projectIds)
                ->whereNull('completed_at')
                ->whereDate('due_on', '<', now())
                ->where('assigned_to_user_id', auth()->id())
                ->with('project:id,name')
                ->with('taskGroup:id,name')
                ->orderBy('due_on')
                ->get(['id', 'name', 'due_on', 'group_id', 'project_id']),
            'recentlyAssignedTasks' => Task::whereIn('project_id', $projectIds)
                ->whereNull('completed_at')
                ->whereNotNull('assigned_at')
                ->where('assigned_to_user_id', auth()->id())
                ->with('project:id,name')
                ->with('taskGroup:id,name')
                ->orderBy('assigned_at')
                ->limit(10)
                ->get(['id', 'name', 'assigned_at', 'group_id', 'project_id']),
            'recentComments' => Comment::query()
                ->whereHas('task', function ($query) use ($projectIds) {
                    $query->whereIn('project_id', $projectIds)
                        ->where('assigned_to_user_id', auth()->id());
                })
                ->with([
                    'task:id,name,project_id',
                    'task.project:id,name',
                    'user:id,name',
                ])
                ->latest()
                ->get(),
            'teamCapacity' => $capacityData,
        ]);
    }

    private function getCapacitySummary()
    {
        $start = now()->startOfWeek();
        $end = now()->endOfWeek();
        $weeklyCapacity = 40; // Default capacity
        $capacityHours = $weeklyCapacity;

        $users = User::withoutRole('client')->get(['id', 'name', 'avatar']);
        $userIds = $users->pluck('id');

        // Quick capacity calculations
        $windowWorkload = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at')
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->whereBetween('tasks.due_on', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('assigned_to_user_id AS user_id, COALESCE(SUM(COALESCE(tasks.estimation, 0)), 0) AS hours')
            ->groupBy('assigned_to_user_id')
            ->pluck('hours', 'user_id');

        $completedCounts = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at')
            ->whereNotNull('tasks.completed_at')
            ->whereBetween('tasks.completed_at', [$start, $end])
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS completed')
            ->pluck('completed', 'user_id');

        $assignedCounts = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at')
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween(DB::raw('COALESCE(tasks.assigned_at, tasks.created_at)'), [$start, $end]);
            })
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS assigned')
            ->pluck('assigned', 'user_id');

        $members = $users->map(function ($user) use ($capacityHours, $windowWorkload, $completedCounts, $assignedCounts) {
            $windowHours = (float) ($windowWorkload[$user->id] ?? 0.0);
            $completed = (int) ($completedCounts[$user->id] ?? 0);
            $assigned = (int) ($assignedCounts[$user->id] ?? 0);

            $plannedUtil = $capacityHours > 0 ? round(min(100, ($windowHours / $capacityHours) * 100), 1) : 0;
            $completionRate = $assigned > 0 ? round(($completed / $assigned) * 100, 1) : null;
            $availability = max(0.0, round($capacityHours - $windowHours, 2));

            return [
                'id' => $user->id,
                'name' => $user->name,
                'avatar' => $user->avatar,
                'planned_utilization' => $plannedUtil,
                'completion_rate' => $completionRate,
                'availability_hours' => $availability,
            ];
        });

        $avgPlannedUtil = $members->avg('planned_utilization') ?? 0;
        $totalAvailable = $members->sum('availability_hours') ?? 0;
        $avgCompletion = $members->whereNotNull('completion_rate')->avg('completion_rate') ?? 0;

        $available = $members->filter(fn ($m) => $m['planned_utilization'] < 90 && $m['availability_hours'] > 8)->count();
        $atCapacity = $members->filter(fn ($m) => $m['planned_utilization'] >= 90 && $m['planned_utilization'] < 100 || $m['availability_hours'] <= 8)->count();
        $overCapacity = $members->filter(fn ($m) => $m['planned_utilization'] >= 100)->count();

        return [
            'summary' => [
                'avg_planned_util' => round($avgPlannedUtil, 1),
                'total_available' => round($totalAvailable, 1),
                'avg_completion' => round($avgCompletion, 1),
                'available' => $available,
                'at_capacity' => $atCapacity,
                'over_capacity' => $overCapacity,
            ],
            'overCapacityMembers' => $members->filter(fn ($m) => $m['planned_utilization'] >= 100)->take(5)->values()->all(),
            'availableMembers' => $members->filter(fn ($m) => $m['planned_utilization'] < 70 && $m['availability_hours'] > 16)->take(5)->values()->all(),
        ];
    }
}
