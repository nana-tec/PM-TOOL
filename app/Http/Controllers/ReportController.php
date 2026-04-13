<?php

namespace App\Http\Controllers;

use App\Enums\PricingType;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function loggedTimeSum(Request $request): Response
    {
        Gate::allowIf(fn (User $user) => $user->can('view logged time sum report'));

        $completed = $request->get('completed', 'true') === 'true';

        return Inertia::render('Reports/LoggedTimeSum', [
            'projects' => DB::table('time_logs')
                ->join('tasks', 'tasks.id', '=', 'time_logs.task_id')
                ->join('projects', 'projects.id', '=', 'tasks.project_id')
                ->join('users', 'time_logs.user_id', '=', 'users.id')
                ->when($request->projects, fn ($query) => $query->whereIn('projects.id', $request->projects))
                ->when($request->users, fn ($query) => $query->whereIn('time_logs.user_id', $request->users))
                ->when($request->dateRange,
                    function ($query) use ($request) {
                        $query->whereBetween('time_logs.created_at', [
                            Carbon::parse($request->dateRange[0])->startOfDay(),
                            Carbon::parse($request->dateRange[1])->endOfDay(),
                        ]);
                    },
                    fn ($query) => $query->where('time_logs.created_at', '>', now()->subWeek())
                )
                ->{$completed ? 'whereNotNull' : 'whereNull'}('tasks.completed_at')
                ->where('billable', $request->get('billable', 'true') === 'true')
                ->groupBy(['tasks.project_id'])
                ->selectRaw('
                    MAX(projects.id) AS project_id, MAX(projects.name) AS project_name,
                    MAX(projects.rate) AS project_rate, MAX(projects.client_company_id) AS client_company_id,
                    MAX(users.id) AS user_id, MAX(users.name) AS user_name, MAX(users.rate) AS user_rate,
                    SUM(time_logs.minutes) / 60 AS total_hours
                ')
                ->orderBy('project_name')
                ->get()
                ->groupBy('project_id'),
            'clientCompanies' => ClientCompany::with('currency')->get(['id', 'name', 'currency_id']),
            'dropdowns' => [
                'projects' => Project::dropdownValues(),
                'users' => User::userDropdownValues(['client']),
            ],
        ]);
    }

    public function dailyLoggedTime(Request $request): Response
    {
        Gate::allowIf(fn (User $user) => $user->can('view daily logged time report'));

        $completed = $request->get('completed', 'true') === 'true';

        $items = DB::table('time_logs')
            ->join('tasks', 'tasks.id', '=', 'time_logs.task_id')
            ->join('projects', 'projects.id', '=', 'tasks.project_id')
            ->join('users', 'time_logs.user_id', '=', 'users.id')
            ->when($request->projects, fn ($query) => $query->whereIn('projects.id', $request->projects))
            ->when($request->users, fn ($query) => $query->whereIn('time_logs.user_id', $request->users))
            ->when($request->dateRange,
                function ($query) use ($request) {
                    $query->whereBetween('time_logs.created_at', [
                        Carbon::parse($request->dateRange[0])->startOfDay(),
                        Carbon::parse($request->dateRange[1])->endOfDay(),
                    ]);
                },
                fn ($query) => $query->where('time_logs.created_at', '>', now()->subWeek())
            )
            ->{$completed ? 'whereNotNull' : 'whereNull'}('tasks.completed_at')
            ->where('billable', $request->get('billable', 'true') === 'true')
            ->groupBy(['time_logs.user_id', 'date'])
            ->selectRaw('
                MAX(projects.id) AS project_id, MAX(projects.name) AS project_name,
                MAX(users.id) AS user_id, MAX(users.name) AS user_name,
                SUM(time_logs.minutes) / 60 AS total_hours, DATE_FORMAT(time_logs.created_at, "%e. %b %Y") AS date
            ')
            ->orderBy('date')
            ->get();

        return Inertia::render('Reports/DailyLoggedTime', [
            'items' => $items
                ->groupBy('date')
                ->map->keyBy('user_id'),
            'users' => $items
                ->unique('user_id')
                ->mapInto(Collection::class)
                ->map->only('user_name', 'user_id')
                ->keyBy('user_id')
                ->sortBy('user_name'),
            'dropdowns' => [
                'projects' => Project::dropdownValues(),
                'users' => User::userDropdownValues(),
            ],
        ]);
    }

    public function fixedPriceSum(Request $request): Response
    {
        Gate::allowIf(fn (User $user) => $user->can('view fixed price sum report'));

        $completed = $request->get('completed', 'true') === 'true';

        return Inertia::render('Reports/FixedPriceSum', [
            'users' => DB::table('tasks')
                ->join('projects', 'projects.id', '=', 'tasks.project_id')
                ->join('users', 'tasks.assigned_to_user_id', '=', 'users.id')
                ->when($request->projects, fn ($query) => $query->whereIn('projects.id', $request->projects))
                ->when($request->users, fn ($query) => $query->whereIn('tasks.assigned_to_user_id', $request->users))
                ->when($request->dateRange,
                    function ($query) use ($request, $completed) {
                        $query->whereBetween('tasks.'.($completed ? 'completed_at' : 'created_at'), [
                            Carbon::parse($request->dateRange[0])->startOfDay(),
                            Carbon::parse($request->dateRange[1])->endOfDay(),
                        ]);
                    },
                    fn ($query) => $query->where('tasks.'.($completed ? 'completed_at' : 'created_at'), '>', now()->subWeek())
                )
                ->{$completed ? 'whereNotNull' : 'whereNull'}('tasks.completed_at')
                ->where('tasks.pricing_type', PricingType::FIXED->value)
                ->where('tasks.billable', $request->get('billable', 'true') === 'true')
                ->whereNotNull('tasks.assigned_to_user_id')
                ->groupBy(['tasks.assigned_to_user_id'])
                ->selectRaw('
                    MAX(users.id) AS user_id,
                    MAX(users.name) AS user_name,
                    SUM(tasks.fixed_price) AS total_fixed_price,
                    COUNT(tasks.id) AS total_tasks
                ')
                ->orderBy('user_name')
                ->get(),
            'clientCompanies' => ClientCompany::with('currency')->get(['id', 'name', 'currency_id']),
            'dropdowns' => [
                'projects' => Project::dropdownValues(),
                'users' => User::userDropdownValues(['client']),
            ],
        ]);
    }

    // ─── Member Report ───────────────────────────────────────────────

    public function memberReport(Request $request): Response
    {
        Gate::allowIf(fn (User $user) => $user->can('view team capacity report'));

        $start = $request->dateRange ? Carbon::parse($request->dateRange[0])->startOfDay() : null;
        $end = $request->dateRange ? Carbon::parse($request->dateRange[1])->endOfDay() : null;

        $usersQuery = User::query()->withoutRole('client');
        if ($request->users && count($request->users)) {
            $usersQuery->whereIn('id', $request->users);
        }
        if ($request->projects && count($request->projects)) {
            $projectIds = $request->projects;
            $usersQuery->whereHas('projects', fn ($q) => $q->whereIn('projects.id', $projectIds));
        }
        $users = $usersQuery->get(['id', 'name', 'avatar']);
        $userIds = $users->pluck('id');

        if ($userIds->isEmpty()) {
            return Inertia::render('Reports/MemberReport', [
                'members' => [],
                'dropdowns' => [
                    'users' => User::userDropdownValues(['client']),
                    'projects' => Project::dropdownValues(),
                ],
            ]);
        }

        $tasksBase = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at');

        $completedQ = (clone $tasksBase)->whereNotNull('tasks.completed_at');
        if ($start && $end) {
            $completedQ->whereBetween('tasks.completed_at', [$start, $end]);
        }
        $completedCounts = $completedQ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $pendingCounts = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $overdueCounts = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->whereDate('tasks.due_on', '<', now()->toDateString())
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        // Subtask counts
        $subCompletedQ = DB::table('sub_tasks AS st')
            ->whereIn('st.assigned_to_user_id', $userIds)
            ->whereNotNull('st.completed_at');
        if ($start && $end) {
            $subCompletedQ->whereBetween('st.completed_at', [$start, $end]);
        }
        $subCompleted = $subCompletedQ->groupBy('st.assigned_to_user_id')
            ->selectRaw('st.assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $subPending = DB::table('sub_tasks AS st')
            ->whereIn('st.assigned_to_user_id', $userIds)
            ->whereNull('st.completed_at')
            ->groupBy('st.assigned_to_user_id')
            ->selectRaw('st.assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $projectCounts = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('archived_at')
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(DISTINCT project_id) AS cnt')
            ->pluck('cnt', 'user_id');

        $nearestDue = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, MIN(tasks.due_on) AS nearest_due')
            ->pluck('nearest_due', 'user_id');

        // Task list per user
        $taskRows = DB::table('tasks')
            ->join('projects', 'projects.id', '=', 'tasks.project_id')
            ->whereIn('tasks.assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at')
            ->when($start && $end, function ($q) use ($start, $end) {
                $q->where(function ($qq) use ($start, $end) {
                    $qq->whereBetween(DB::raw('COALESCE(tasks.assigned_at, tasks.created_at)'), [$start, $end])
                        ->orWhereBetween('tasks.completed_at', [$start, $end])
                        ->orWhere(fn ($qqq) => $qqq->whereNull('tasks.completed_at'));
                });
            })
            ->select([
                'tasks.id', 'tasks.name', 'tasks.due_on', 'tasks.estimation',
                'tasks.completed_at', 'tasks.assigned_to_user_id',
                'tasks.priority', 'tasks.complexity',
                'projects.id as project_id', 'projects.name as project_name',
            ])
            ->orderByDesc('tasks.created_at')
            ->limit(2000)
            ->get()
            ->groupBy('assigned_to_user_id');

        // Subtasks per user
        $subTaskRows = DB::table('sub_tasks AS st')
            ->join('tasks', 'tasks.id', '=', 'st.task_id')
            ->join('projects', 'projects.id', '=', 'tasks.project_id')
            ->whereIn('st.assigned_to_user_id', $userIds)
            ->select([
                'st.id', 'st.name', 'st.due_on', 'st.estimation',
                'st.completed_at', 'st.assigned_to_user_id', 'st.task_id',
                'tasks.name as parent_task_name',
                'projects.id as project_id', 'projects.name as project_name',
            ])
            ->orderByDesc('st.created_at')
            ->limit(2000)
            ->get()
            ->groupBy('assigned_to_user_id');

        $members = $users->map(function ($user) use (
            $completedCounts, $pendingCounts, $overdueCounts,
            $subCompleted, $subPending, $projectCounts, $nearestDue,
            $taskRows, $subTaskRows
        ) {
            $completed = (int) ($completedCounts[$user->id] ?? 0);
            $pending = (int) ($pendingCounts[$user->id] ?? 0);
            $overdue = (int) ($overdueCounts[$user->id] ?? 0);
            $subDone = (int) ($subCompleted[$user->id] ?? 0);
            $subPend = (int) ($subPending[$user->id] ?? 0);
            $projects = (int) ($projectCounts[$user->id] ?? 0);
            $allUnits = $completed + $subDone + $pending + $subPend;
            $completedUnits = $completed + $subDone;
            $completionRate = $allUnits > 0 ? round(($completedUnits / $allUnits) * 100, 1) : 0;

            return [
                'user' => ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar],
                'tasks_completed' => $completed,
                'tasks_pending' => $pending,
                'tasks_overdue' => $overdue,
                'subtasks_completed' => $subDone,
                'subtasks_pending' => $subPend,
                'total_completed' => $completedUnits,
                'total_pending' => $pending + $subPend,
                'completion_rate' => $completionRate,
                'projects_count' => $projects,
                'nearest_due' => $nearestDue[$user->id] ?? null,
                'rank' => 0,
                'tasks' => ($taskRows[$user->id] ?? collect())->values()->toArray(),
                'subtasks' => ($subTaskRows[$user->id] ?? collect())->values()->toArray(),
            ];
        });

        $ranked = $members->sortByDesc(function ($m) {
            return [$m['completion_rate'], $m['total_completed']];
        })->values()->map(function ($m, $idx) {
            $m['rank'] = $idx + 1;
            return $m;
        });

        return Inertia::render('Reports/MemberReport', [
            'members' => $ranked->all(),
            'dropdowns' => [
                'users' => User::userDropdownValues(['client']),
                'projects' => Project::dropdownValues(),
            ],
        ]);
    }

    // ─── Project Report ──────────────────────────────────────────────

    public function projectReport(Request $request): Response
    {
        Gate::allowIf(fn (User $user) => $user->can('view team capacity report'));

        $start = $request->dateRange ? Carbon::parse($request->dateRange[0])->startOfDay() : null;
        $end = $request->dateRange ? Carbon::parse($request->dateRange[1])->endOfDay() : null;

        $projectsQuery = Project::query()->orderBy('name');
        if ($request->projects && count($request->projects)) {
            $projectsQuery->whereIn('id', $request->projects);
        }
        $projects = $projectsQuery->get(['id', 'name', 'description']);

        if ($projects->isEmpty()) {
            return Inertia::render('Reports/ProjectReport', [
                'projects' => [],
                'dropdowns' => [
                    'users' => User::userDropdownValues(['client']),
                    'projects' => Project::dropdownValues(),
                ],
            ]);
        }

        $projectIds = $projects->pluck('id');

        $completedQ = DB::table('tasks')
            ->whereIn('project_id', $projectIds)
            ->whereNull('archived_at')
            ->whereNotNull('completed_at');
        if ($start && $end) {
            $completedQ->whereBetween('completed_at', [$start, $end]);
        }
        $completedCounts = $completedQ->groupBy('project_id')
            ->selectRaw('project_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'project_id');

        $pendingCounts = DB::table('tasks')
            ->whereIn('project_id', $projectIds)
            ->whereNull('archived_at')
            ->whereNull('completed_at')
            ->groupBy('project_id')
            ->selectRaw('project_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'project_id');

        $totalCounts = DB::table('tasks')
            ->whereIn('project_id', $projectIds)
            ->whereNull('archived_at')
            ->groupBy('project_id')
            ->selectRaw('project_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'project_id');

        $overdueCounts = DB::table('tasks')
            ->whereIn('project_id', $projectIds)
            ->whereNull('archived_at')
            ->whereNull('completed_at')
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<', now()->toDateString())
            ->groupBy('project_id')
            ->selectRaw('project_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'project_id');

        // Subtask counts per project
        $subCompletedQ = DB::table('sub_tasks AS st')
            ->join('tasks', 'tasks.id', '=', 'st.task_id')
            ->whereIn('tasks.project_id', $projectIds)
            ->whereNull('tasks.archived_at')
            ->whereNotNull('st.completed_at');
        if ($start && $end) {
            $subCompletedQ->whereBetween('st.completed_at', [$start, $end]);
        }
        $subCompleted = $subCompletedQ->groupBy('tasks.project_id')
            ->selectRaw('tasks.project_id AS project_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'project_id');

        $subPending = DB::table('sub_tasks AS st')
            ->join('tasks', 'tasks.id', '=', 'st.task_id')
            ->whereIn('tasks.project_id', $projectIds)
            ->whereNull('tasks.archived_at')
            ->whereNull('st.completed_at')
            ->groupBy('tasks.project_id')
            ->selectRaw('tasks.project_id AS project_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'project_id');

        $subTotal = DB::table('sub_tasks AS st')
            ->join('tasks', 'tasks.id', '=', 'st.task_id')
            ->whereIn('tasks.project_id', $projectIds)
            ->whereNull('tasks.archived_at')
            ->groupBy('tasks.project_id')
            ->selectRaw('tasks.project_id AS project_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'project_id');

        $nearestDue = DB::table('tasks')
            ->whereIn('project_id', $projectIds)
            ->whereNull('archived_at')
            ->whereNull('completed_at')
            ->whereNotNull('due_on')
            ->groupBy('project_id')
            ->selectRaw('project_id, MIN(due_on) AS nearest_due')
            ->pluck('nearest_due', 'project_id');

        $membersPerProject = DB::table('project_user_access')
            ->join('users', 'users.id', '=', 'project_user_access.user_id')
            ->whereIn('project_user_access.project_id', $projectIds)
            ->select(['project_user_access.project_id', 'users.id', 'users.name', 'users.avatar'])
            ->get()
            ->groupBy('project_id');

        // Task list per project
        $taskRows = DB::table('tasks')
            ->leftJoin('users', 'users.id', '=', 'tasks.assigned_to_user_id')
            ->whereIn('tasks.project_id', $projectIds)
            ->whereNull('tasks.archived_at')
            ->select([
                'tasks.id', 'tasks.name', 'tasks.due_on', 'tasks.estimation',
                'tasks.completed_at', 'tasks.project_id', 'tasks.priority', 'tasks.complexity',
                'users.id as assignee_id', 'users.name as assignee_name', 'users.avatar as assignee_avatar',
            ])
            ->orderByDesc('tasks.created_at')
            ->limit(3000)
            ->get()
            ->groupBy('project_id');

        // Subtasks per project
        $subTaskRows = DB::table('sub_tasks AS st')
            ->join('tasks', 'tasks.id', '=', 'st.task_id')
            ->leftJoin('users', 'users.id', '=', 'st.assigned_to_user_id')
            ->whereIn('tasks.project_id', $projectIds)
            ->whereNull('tasks.archived_at')
            ->select([
                'st.id', 'st.name', 'st.due_on', 'st.estimation',
                'st.completed_at', 'st.task_id', 'tasks.project_id',
                'tasks.name as parent_task_name',
                'users.id as assignee_id', 'users.name as assignee_name',
            ])
            ->orderByDesc('st.created_at')
            ->limit(3000)
            ->get()
            ->groupBy('project_id');

        $result = $projects->map(function ($project) use (
            $completedCounts, $pendingCounts, $totalCounts, $overdueCounts,
            $subCompleted, $subPending, $subTotal, $nearestDue,
            $membersPerProject, $taskRows, $subTaskRows
        ) {
            $tasksCompleted = (int) ($completedCounts[$project->id] ?? 0);
            $tasksPending = (int) ($pendingCounts[$project->id] ?? 0);
            $tasksTotal = (int) ($totalCounts[$project->id] ?? 0);
            $tasksOverdue = (int) ($overdueCounts[$project->id] ?? 0);
            $subDone = (int) ($subCompleted[$project->id] ?? 0);
            $subPend = (int) ($subPending[$project->id] ?? 0);
            $subTot = (int) ($subTotal[$project->id] ?? 0);

            $totalAll = $tasksTotal + $subTot;
            $completedAll = $tasksCompleted + $subDone;
            $progress = $totalAll > 0 ? round(($completedAll / $totalAll) * 100, 1) : 0;

            $members = ($membersPerProject[$project->id] ?? collect())->map(fn ($m) => [
                'id' => $m->id,
                'name' => $m->name,
                'avatar' => $m->avatar,
            ])->values()->toArray();

            return [
                'project' => ['id' => $project->id, 'name' => $project->name],
                'members' => $members,
                'members_count' => count($members),
                'tasks_completed' => $tasksCompleted,
                'tasks_pending' => $tasksPending,
                'tasks_total' => $tasksTotal,
                'tasks_overdue' => $tasksOverdue,
                'subtasks_completed' => $subDone,
                'subtasks_pending' => $subPend,
                'subtasks_total' => $subTot,
                'total_items' => $totalAll,
                'total_completed' => $completedAll,
                'progress' => $progress,
                'nearest_due' => $nearestDue[$project->id] ?? null,
                'tasks' => ($taskRows[$project->id] ?? collect())->values()->toArray(),
                'subtasks' => ($subTaskRows[$project->id] ?? collect())->values()->toArray(),
            ];
        });

        return Inertia::render('Reports/ProjectReport', [
            'projects' => $result->all(),
            'dropdowns' => [
                'users' => User::userDropdownValues(['client']),
                'projects' => Project::dropdownValues(),
            ],
        ]);
    }

    // ─── Workload Report ─────────────────────────────────────────────

    public function workloadReport(Request $request): Response
    {
        Gate::allowIf(fn (User $user) => $user->can('view team capacity report'));

        $start = $request->dateRange ? Carbon::parse($request->dateRange[0])->startOfDay() : null;
        $end = $request->dateRange ? Carbon::parse($request->dateRange[1])->endOfDay() : null;

        $usersQuery = User::query()->withoutRole('client');
        if ($request->users && count($request->users)) {
            $usersQuery->whereIn('id', $request->users);
        }
        if ($request->projects && count($request->projects)) {
            $projectIds = $request->projects;
            $usersQuery->whereHas('projects', fn ($q) => $q->whereIn('projects.id', $projectIds));
        }
        $users = $usersQuery->get(['id', 'name', 'avatar']);
        $userIds = $users->pluck('id');

        if ($userIds->isEmpty()) {
            return Inertia::render('Reports/WorkloadReport', [
                'members' => [],
                'dropdowns' => [
                    'users' => User::userDropdownValues(['client']),
                    'projects' => Project::dropdownValues(),
                ],
            ]);
        }

        $tasksBase = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at');

        $openTasks = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $openSubtasks = DB::table('sub_tasks AS st')
            ->whereIn('st.assigned_to_user_id', $userIds)
            ->whereNull('st.completed_at')
            ->groupBy('st.assigned_to_user_id')
            ->selectRaw('st.assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $overdueTasks = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->whereDate('tasks.due_on', '<', now()->toDateString())
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $overdueSubtasks = DB::table('sub_tasks AS st')
            ->whereIn('st.assigned_to_user_id', $userIds)
            ->whereNull('st.completed_at')
            ->whereNotNull('st.due_on')
            ->whereDate('st.due_on', '<', now()->toDateString())
            ->groupBy('st.assigned_to_user_id')
            ->selectRaw('st.assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $completedTasksQ = (clone $tasksBase)->whereNotNull('tasks.completed_at');
        if ($start && $end) {
            $completedTasksQ->whereBetween('tasks.completed_at', [$start, $end]);
        }
        $completedTasks = $completedTasksQ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $completedSubQ = DB::table('sub_tasks AS st')
            ->whereIn('st.assigned_to_user_id', $userIds)
            ->whereNotNull('st.completed_at');
        if ($start && $end) {
            $completedSubQ->whereBetween('st.completed_at', [$start, $end]);
        }
        $completedSubs = $completedSubQ->groupBy('st.assigned_to_user_id')
            ->selectRaw('st.assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $estimatedHours = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COALESCE(SUM(tasks.estimation), 0) AS hours')
            ->pluck('hours', 'user_id');

        $estimatedSubHours = DB::table('sub_tasks AS st')
            ->whereIn('st.assigned_to_user_id', $userIds)
            ->whereNull('st.completed_at')
            ->groupBy('st.assigned_to_user_id')
            ->selectRaw('st.assigned_to_user_id AS user_id, COALESCE(SUM(st.estimation), 0) AS hours')
            ->pluck('hours', 'user_id');

        $timeLoggedQ = DB::table('time_logs')
            ->join('tasks', 'tasks.id', '=', 'time_logs.task_id')
            ->whereIn('time_logs.user_id', $userIds);
        if ($start && $end) {
            $timeLoggedQ->whereBetween('time_logs.created_at', [$start, $end]);
        }
        $timeLogged = $timeLoggedQ->groupBy('time_logs.user_id')
            ->selectRaw('time_logs.user_id AS user_id, SUM(time_logs.minutes)/60 AS hours')
            ->pluck('hours', 'user_id');

        $projectsPerUser = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('archived_at')
            ->whereNull('completed_at')
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(DISTINCT project_id) AS cnt')
            ->pluck('cnt', 'user_id');

        $perUserProject = DB::table('tasks')
            ->join('projects', 'projects.id', '=', 'tasks.project_id')
            ->whereIn('tasks.assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at')
            ->groupBy('tasks.assigned_to_user_id', 'tasks.project_id')
            ->selectRaw('
                tasks.assigned_to_user_id AS user_id,
                tasks.project_id,
                MAX(projects.name) AS project_name,
                SUM(CASE WHEN tasks.completed_at IS NULL THEN 1 ELSE 0 END) AS open_tasks,
                SUM(CASE WHEN tasks.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done_tasks,
                SUM(CASE WHEN tasks.completed_at IS NULL THEN COALESCE(tasks.estimation, 0) ELSE 0 END) AS open_hours
            ')
            ->get()
            ->groupBy('user_id');

        $dueSoon = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->whereBetween('tasks.due_on', [now()->toDateString(), now()->addDays(7)->toDateString()])
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $highPriority = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereIn('tasks.priority', ['urgent', 'high'])
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'user_id');

        $members = $users->map(function ($user) use (
            $openTasks, $openSubtasks, $overdueTasks, $overdueSubtasks,
            $completedTasks, $completedSubs, $estimatedHours, $estimatedSubHours,
            $timeLogged, $projectsPerUser, $perUserProject, $dueSoon, $highPriority
        ) {
            $open = (int) ($openTasks[$user->id] ?? 0);
            $openSub = (int) ($openSubtasks[$user->id] ?? 0);
            $overdue = (int) ($overdueTasks[$user->id] ?? 0);
            $overdueSub = (int) ($overdueSubtasks[$user->id] ?? 0);
            $done = (int) ($completedTasks[$user->id] ?? 0);
            $doneSub = (int) ($completedSubs[$user->id] ?? 0);
            $estH = (float) ($estimatedHours[$user->id] ?? 0);
            $estSubH = (float) ($estimatedSubHours[$user->id] ?? 0);
            $logged = (float) ($timeLogged[$user->id] ?? 0);
            $projects = (int) ($projectsPerUser[$user->id] ?? 0);
            $soon = (int) ($dueSoon[$user->id] ?? 0);
            $highPri = (int) ($highPriority[$user->id] ?? 0);

            $totalOpen = $open + $openSub;
            $totalOverdue = $overdue + $overdueSub;
            $totalDone = $done + $doneSub;
            $totalEstHours = round($estH + $estSubH, 1);

            $projectBreakdown = ($perUserProject[$user->id] ?? collect())->map(fn ($r) => [
                'project_id' => $r->project_id,
                'project_name' => $r->project_name,
                'open_tasks' => (int) $r->open_tasks,
                'done_tasks' => (int) $r->done_tasks,
                'open_hours' => round((float) $r->open_hours, 1),
            ])->values()->toArray();

            return [
                'user' => ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar],
                'open_tasks' => $open,
                'open_subtasks' => $openSub,
                'total_open' => $totalOpen,
                'overdue_tasks' => $overdue,
                'overdue_subtasks' => $overdueSub,
                'total_overdue' => $totalOverdue,
                'completed_tasks' => $done,
                'completed_subtasks' => $doneSub,
                'total_completed' => $totalDone,
                'estimated_hours' => $totalEstHours,
                'time_logged' => round($logged, 1),
                'projects_count' => $projects,
                'due_soon' => $soon,
                'high_priority' => $highPri,
                'project_breakdown' => $projectBreakdown,
            ];
        });

        $sorted = $members->sortByDesc('total_open')->values();

        return Inertia::render('Reports/WorkloadReport', [
            'members' => $sorted->all(),
            'dropdowns' => [
                'users' => User::userDropdownValues(['client']),
                'projects' => Project::dropdownValues(),
            ],
        ]);
    }
}
