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
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    private function computeTeamMetrics(Request $request): array
    {
        Gate::allowIf(fn (User $user) => $user->can('view team capacity report'));

        $start = $request->dateRange ? Carbon::parse($request->dateRange[0])->startOfDay() : now()->startOfWeek();
        $end = $request->dateRange ? Carbon::parse($request->dateRange[1])->endOfDay() : now()->endOfWeek();
        $days = max(1, $start->diffInDays($end) + 1);
        $weeks = $days / 7;
        $weeklyCapacity = (float) ($request->get('weekly_capacity', 40));
        $capacityHours = $weeklyCapacity * $weeks;
        $rankBy = in_array($request->get('rank_by'), ['performance', 'availability', 'risk', 'utilization', 'planned', 'actual']) ? $request->get('rank_by') : 'performance';

        $usersQuery = User::query()->withoutRole('client');
        if ($request->users) {
            $usersQuery->whereIn('id', $request->users);
        }
        $users = $usersQuery->get(['id', 'name', 'avatar']);
        $userIds = $users->pluck('id');

        $tasksBase = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at');

        $pendingCounts = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS pending')
            ->pluck('pending', 'user_id');

        $overdueCounts = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->whereDate('tasks.due_on', '<', now()->toDateString())
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS overdue')
            ->pluck('overdue', 'user_id');

        $completedCounts = (clone $tasksBase)
            ->whereNotNull('tasks.completed_at')
            ->whereBetween('tasks.completed_at', [$start, $end])
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS completed')
            ->pluck('completed', 'user_id');

        $assignedCounts = (clone $tasksBase)
            ->whereBetween(DB::raw('COALESCE(tasks.assigned_at, tasks.created_at)'), [$start, $end])
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS assigned')
            ->pluck('assigned', 'user_id');

        $windowWorkload = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->whereBetween('tasks.due_on', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('assigned_to_user_id AS user_id, COALESCE(SUM(COALESCE(tasks.estimation, 0)), 0) AS hours')
            ->groupBy('assigned_to_user_id')
            ->pluck('hours', 'user_id');

        $projectsCounts = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween(DB::raw('COALESCE(tasks.assigned_at, tasks.created_at)'), [$start, $end])
                    ->orWhereBetween('tasks.completed_at', [$start, $end]);
            })
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(DISTINCT project_id) AS projects')
            ->pluck('projects', 'user_id');

        $timeLogged = DB::table('time_logs')
            ->join('tasks', 'tasks.id', '=', 'time_logs.task_id')
            ->whereIn('time_logs.user_id', $userIds)
            ->whereBetween('time_logs.created_at', [$start, $end])
            ->groupBy('time_logs.user_id')
            ->selectRaw('time_logs.user_id AS user_id, SUM(time_logs.minutes)/60 AS hours, COUNT(DISTINCT DATE(time_logs.created_at)) AS active_days')
            ->get()
            ->keyBy('user_id');

        $activeDays = $timeLogged->mapWithKeys(fn ($r, $uid) => [$uid => (int) $r->active_days]);
        $loggedHours = $timeLogged->mapWithKeys(fn ($r, $uid) => [$uid => (float) $r->hours]);

        $firstLogs = DB::table('time_logs')
            ->selectRaw('task_id, MIN(created_at) AS first_log_at')
            ->whereIn('user_id', $userIds)
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('task_id');

        $latencyRows = DB::table('tasks')
            ->joinSub($firstLogs, 'first_logs', function ($join) {
                $join->on('first_logs.task_id', '=', 'tasks.id');
            })
            ->whereIn('tasks.assigned_to_user_id', $userIds)
            ->whereBetween(DB::raw('COALESCE(tasks.assigned_at, tasks.created_at)'), [$start, $end])
            ->selectRaw('assigned_to_user_id AS user_id, AVG(TIMESTAMPDIFF(MINUTE, COALESCE(tasks.assigned_at, tasks.created_at), first_logs.first_log_at))/60 AS latency_hours')
            ->groupBy('assigned_to_user_id')
            ->pluck('latency_hours', 'user_id');

        $items = $users->map(function ($user) use ($capacityHours, $weeks, $pendingCounts, $overdueCounts, $completedCounts, $assignedCounts, $windowWorkload, $projectsCounts, $activeDays, $loggedHours, $latencyRows, $days) {
            $pending = (int) ($pendingCounts[$user->id] ?? 0);
            $overdue = (int) ($overdueCounts[$user->id] ?? 0);
            $completed = (int) ($completedCounts[$user->id] ?? 0);
            $assigned = (int) ($assignedCounts[$user->id] ?? 0);
            $projects = (int) ($projectsCounts[$user->id] ?? 0);
            $windowHours = (float) ($windowWorkload[$user->id] ?? 0.0);
            $hoursLogged = (float) ($loggedHours[$user->id] ?? 0.0);
            $actDays = (int) ($activeDays[$user->id] ?? 0);
            $idleDays = round(max(0, $days - $actDays), 1);
            $avgDaily = $actDays > 0 ? round($hoursLogged / $actDays, 2) : 0.0;
            $throughput = $weeks > 0 ? round($completed / $weeks, 2) : $completed;
            $completionRate = $assigned > 0 ? round(($completed / $assigned) * 100, 1) : null;
            $plannedUtil = $capacityHours > 0 ? round(min(100, ($windowHours / $capacityHours) * 100), 1) : null;
            $actualUtil = $capacityHours > 0 ? round(min(100, ($hoursLogged / $capacityHours) * 100), 1) : null;
            $availabilityHours = max(0.0, round($capacityHours - $windowHours, 2));
            $latency = isset($latencyRows[$user->id]) ? round(max(0, (float) $latencyRows[$user->id]), 2) : null; // hours

            $risk = 0.0;
            $risk += min(40, $overdue * 2.5);
            if (($plannedUtil ?? 0) >= 100) {
                $risk += 20;
            } elseif (($plannedUtil ?? 0) >= 90) {
                $risk += 10;
            } elseif (($plannedUtil ?? 0) >= 75) {
                $risk += 5;
            }
            $risk += min(20, ($idleDays / $days) * 20);
            if (! is_null($completionRate)) {
                if ($completionRate < 50) {
                    $risk += 20;
                } elseif ($completionRate < 70) {
                    $risk += 10;
                } elseif ($completionRate < 85) {
                    $risk += 5;
                }
            }
            $riskScore = round(min(100, $risk), 1);

            return [
                'user' => ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar],
                'rank' => 0,
                'availability_hours' => $availabilityHours,
                'planned_utilization' => $plannedUtil,
                'actual_utilization' => $actualUtil,
                'pending' => $pending,
                'overdue' => $overdue,
                'completed' => $completed,
                'assigned' => $assigned,
                'projects' => $projects,
                'time_logged_hours' => round($hoursLogged, 2),
                'active_days' => $actDays,
                'idle_days' => $idleDays,
                'avg_daily_hours' => $avgDaily,
                'start_latency_hours' => $latency,
                'throughput_per_week' => $throughput,
                'completion_rate' => $completionRate,
                'risk_score' => $riskScore,
            ];
        });

        $ranked = match ($rankBy) {
            'availability' => $items->sortByDesc('availability_hours')->values(),
            'risk' => $items->sortByDesc('risk_score')->values(),
            'utilization', 'planned' => $items->sortByDesc(fn ($i) => $i['planned_utilization'] ?? -1)->values(),
            'actual' => $items->sortByDesc(fn ($i) => $i['actual_utilization'] ?? -1)->values(),
            default => $items->sortByDesc(function ($i) {
                return [$i['completion_rate'] ?? -1, $i['throughput_per_week']];
            })->values(),
        };

        $ranked = $ranked->map(function ($i, $idx) {
            $i['rank'] = $idx + 1;

            return $i;
        });

        return [
            'items' => $ranked->all(),
            'meta' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'capacity_hours' => $capacityHours,
                'weekly_capacity' => $weeklyCapacity,
                'rank_by' => $rankBy,
            ],
            'dropdowns' => ['users' => User::userDropdownValues(['client'])],
        ];
    }

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

    public function teamCapacity(Request $request): Response
    {
        Gate::allowIf(fn (User $user) => $user->can('view team capacity report'));

        $start = $request->dateRange ? Carbon::parse($request->dateRange[0])->startOfDay() : now()->startOfWeek();
        $end = $request->dateRange ? Carbon::parse($request->dateRange[1])->endOfDay() : now()->endOfWeek();
        $days = max(1, $start->diffInDays($end) + 1);
        $weeks = $days / 7;
        $weeklyCapacity = (float) ($request->get('weekly_capacity', 40));
        $capacityHours = $weeklyCapacity * $weeks;
        $rankBy = in_array($request->get('rank_by'), ['performance', 'planned', 'actual']) ? $request->get('rank_by') : 'performance';

        // Users to include (exclude clients by default)
        $usersQuery = User::query()->withoutRole('client');
        if ($request->users) {
            $usersQuery->whereIn('id', $request->users);
        }
        $users = $usersQuery->get(['id', 'name', 'avatar']);

        $userIds = $users->pluck('id');

        // Aggregate task metrics
        $tasksBase = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->whereNull('tasks.archived_at');

        // Pending (open) tasks count per user
        $pendingCounts = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS pending')
            ->pluck('pending', 'user_id');

        // Overdue (open and due_on < today)
        $overdueCounts = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->whereDate('tasks.due_on', '<', now()->toDateString())
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS overdue')
            ->pluck('overdue', 'user_id');

        // Completed in range
        $completedCounts = (clone $tasksBase)
            ->whereNotNull('tasks.completed_at')
            ->whereBetween('tasks.completed_at', [$start, $end])
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS completed')
            ->pluck('completed', 'user_id');

        // Assigned in range (prefer assigned_at, fallback to created_at)
        $assignedCounts = (clone $tasksBase)
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween(DB::raw('COALESCE(tasks.assigned_at, tasks.created_at)'), [$start, $end]);
            })
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(*) AS assigned')
            ->pluck('assigned', 'user_id');

        // Open workload (sum estimation hours of open tasks)
        $openWorkload = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->selectRaw('assigned_to_user_id AS user_id, COALESCE(SUM(COALESCE(tasks.estimation, 0)), 0) AS hours')
            ->groupBy('assigned_to_user_id')
            ->pluck('hours', 'user_id');

        // Workload due within window (open tasks due in range)
        $windowWorkload = (clone $tasksBase)
            ->whereNull('tasks.completed_at')
            ->whereNotNull('tasks.due_on')
            ->whereBetween('tasks.due_on', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('assigned_to_user_id AS user_id, COALESCE(SUM(COALESCE(tasks.estimation, 0)), 0) AS hours')
            ->groupBy('assigned_to_user_id')
            ->pluck('hours', 'user_id');

        // Distinct projects worked on (in range: via completed or assigned)
        $projectsCounts = DB::table('tasks')
            ->whereIn('assigned_to_user_id', $userIds)
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween(DB::raw('COALESCE(tasks.assigned_at, tasks.created_at)'), [$start, $end])
                    ->orWhereBetween('tasks.completed_at', [$start, $end]);
            })
            ->groupBy('assigned_to_user_id')
            ->selectRaw('assigned_to_user_id AS user_id, COUNT(DISTINCT project_id) AS projects')
            ->pluck('projects', 'user_id');

        // Time logged in window (actual utilization)
        $timeLogged = DB::table('time_logs')
            ->join('tasks', 'tasks.id', '=', 'time_logs.task_id')
            ->whereIn('time_logs.user_id', $userIds)
            ->whereBetween('time_logs.created_at', [$start, $end])
            ->groupBy('time_logs.user_id')
            ->selectRaw('time_logs.user_id AS user_id, SUM(time_logs.minutes)/60 AS hours')
            ->pluck('hours', 'user_id');

        // Build items
        $items = $users->map(function ($user) use (
            $capacityHours, $weeks, $pendingCounts, $overdueCounts, $completedCounts, $assignedCounts, $openWorkload, $windowWorkload, $projectsCounts, $timeLogged
        ) {
            $pending = (int) ($pendingCounts[$user->id] ?? 0);
            $overdue = (int) ($overdueCounts[$user->id] ?? 0);
            $completed = (int) ($completedCounts[$user->id] ?? 0);
            $assigned = (int) ($assignedCounts[$user->id] ?? 0);
            $projects = (int) ($projectsCounts[$user->id] ?? 0);
            $openHours = (float) ($openWorkload[$user->id] ?? 0.0);
            $windowHours = (float) ($windowWorkload[$user->id] ?? 0.0);
            $loggedHours = (float) ($timeLogged[$user->id] ?? 0.0);

            $completionRate = $assigned > 0 ? round(($completed / $assigned) * 100, 1) : null;
            $throughput = $weeks > 0 ? round($completed / $weeks, 2) : $completed; // tasks per week

            // Utilization: prefer planned hours in window; fall back to actual logged hours
            $plannedUtil = $capacityHours > 0 ? round(min(100, ($windowHours / $capacityHours) * 100), 1) : null;
            $actualUtil = $capacityHours > 0 ? round(min(100, ($loggedHours / $capacityHours) * 100), 1) : null;

            $availabilityHours = max(0.0, round($capacityHours - $windowHours, 2));

            return [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar' => $user->avatar,
                ],
                'pending' => $pending,
                'overdue' => $overdue,
                'completed' => $completed,
                'assigned' => $assigned,
                'projects' => $projects,
                'open_estimation_hours' => round($openHours, 2),
                'window_estimation_hours' => round($windowHours, 2),
                'time_logged_hours' => round($loggedHours, 2),
                'planned_utilization' => $plannedUtil,
                'actual_utilization' => $actualUtil,
                'availability_hours' => $availabilityHours,
                'completion_rate' => $completionRate,
                'throughput_per_week' => $throughput,
            ];
        });

        // Ranking
        if ($rankBy === 'planned') {
            $ranked = $items->sortByDesc(fn ($i) => $i['planned_utilization'] ?? -1)->values();
        } elseif ($rankBy === 'actual') {
            $ranked = $items->sortByDesc(fn ($i) => $i['actual_utilization'] ?? -1)->values();
        } else { // performance (default)
            $ranked = $items->sortByDesc(function ($i) {
                return [
                    $i['completion_rate'] ?? -1,
                    $i['throughput_per_week'],
                ];
            })->values();
        }

        // Attach rank
        $ranked = $ranked->map(function ($i, $idx) {
            $i['rank'] = $idx + 1;

            return $i;
        });

        return Inertia::render('Reports/TeamCapacity', [
            'items' => $ranked,
            'meta' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'capacity_hours' => $capacityHours,
                'weekly_capacity' => $weeklyCapacity,
                'rank_by' => $rankBy,
            ],
            'dropdowns' => [
                'users' => User::userDropdownValues(['client']),
            ],
        ]);
    }

    public function userTasks(Request $request)
    {
        Gate::allowIf(fn (User $user) => $user->can('view team capacity report'));

        $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'status' => ['required', 'in:pending,overdue,completed'],
            'dateRange' => ['array', 'size:2'],
        ]);

        $userId = (int) $request->user_id;
        $status = $request->status;
        $start = $request->dateRange ? Carbon::parse($request->dateRange[0])->startOfDay() : now()->startOfWeek();
        $end = $request->dateRange ? Carbon::parse($request->dateRange[1])->endOfDay() : now()->endOfWeek();

        $q = DB::table('tasks')
            ->join('projects', 'projects.id', '=', 'tasks.project_id')
            ->where('tasks.assigned_to_user_id', $userId)
            ->whereNull('tasks.archived_at')
            ->select([
                'tasks.id', 'tasks.name', 'tasks.due_on', 'tasks.estimation', 'tasks.completed_at', 'tasks.created_at',
                'projects.id as project_id', 'projects.name as project_name',
            ])
            ->orderByDesc('tasks.created_at');

        if ($status === 'pending') {
            $q->whereNull('tasks.completed_at');
        } elseif ($status === 'overdue') {
            $q->whereNull('tasks.completed_at')
                ->whereNotNull('tasks.due_on')
                ->whereDate('tasks.due_on', '<', now()->toDateString());
        } else { // completed
            $q->whereNotNull('tasks.completed_at')
                ->whereBetween('tasks.completed_at', [$start, $end]);
        }

        $tasks = $q->limit(100)->get();

        return response()->json(['tasks' => $tasks]);
    }

    public function teamMetrics(Request $request): Response
    {
        $data = $this->computeTeamMetrics($request);

        return Inertia::render('Reports/TeamMetrics', $data);
    }

    public function teamMetricsJson(Request $request)
    {
        // Short server-side cache (60s) to reduce dashboard load
        $start = $request->dateRange ? Carbon::parse($request->dateRange[0])->startOfDay() : now()->startOfWeek();
        $end = $request->dateRange ? Carbon::parse($request->dateRange[1])->endOfDay() : now()->endOfWeek();
        $norm = [
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
            'weekly_capacity' => (float) ($request->get('weekly_capacity', 40)),
            'rank_by' => $request->get('rank_by') ?: 'performance',
            'users' => array_values(array_map('intval', (array) $request->get('users', []))),
        ];
        $uid = auth()->id() ?: 0;
        $key = 'team-metrics:json:u:'.$uid.':'.md5(json_encode($norm));
        $data = Cache::remember($key, 60, function () use ($request) {
            return $this->computeTeamMetrics($request);
        });

        $limit = (int) $request->get('limit', 20);

        return response()->json([
            'items' => collect($data['items'] ?? [])->take($limit)->values(),
            'meta' => $data['meta'] ?? [],
        ]);
    }

    public function suggestAssignees(Request $request)
    {
        Gate::allowIf(fn (User $user) => $user->can('view team capacity report'));

        $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
            'dateRange' => ['array'],
            'weekly_capacity' => ['nullable', 'numeric', 'min:1', 'max:80'],
        ]);

        $limit = (int) ($request->get('limit', 5));

        // Determine eligible users
        if ($request->project_id) {
            $project = Project::findOrFail($request->project_id);
            $eligible = \App\Services\PermissionService::usersWithAccessToProject($project)->pluck('id');
        } else {
            $eligible = User::withoutRole('client')->pluck('id');
        }

        // Reuse computation but restrict users
        $req = new Request(array_merge($request->all(), ['users' => $eligible->toArray(), 'rank_by' => 'availability']));
        $data = $this->computeTeamMetrics($req);
        $items = collect($data['items'] ?? [])->sortByDesc('availability_hours')->take($limit)->values()->map(function ($i) {
            return collect($i)->only(['user', 'availability_hours', 'planned_utilization', 'actual_utilization', 'pending', 'overdue', 'projects']);
        });

        return response()->json(['candidates' => $items]);
    }
}
