<?php

use App\Enums\PricingType;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskGroup;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

function actingAsAdminWithTaskPermissions(): User {
    $user = User::factory()->create();
    $role = Role::firstOrCreate(['name' => 'admin']);

    $perms = [
        'view tasks', 'create task', 'edit task', 'archive task', 'restore task', 'reorder task', 'complete task'
    ];
    foreach ($perms as $permName) {
        $perm = Permission::firstOrCreate(['name' => $permName]);
        $role->givePermissionTo($perm);
    }

    $user->assignRole($role);
    Sanctum::actingAs($user);

    return $user;
}

it('returns task audit history for authorized users', function () {
    actingAsAdminWithTaskPermissions();

    $company = ClientCompany::factory()->create();
    $project = Project::create([
        'client_company_id' => $company->id,
        'name' => 'History Project',
    ]);

    $group = TaskGroup::create([
        'name' => 'To Do',
        'project_id' => $project->id,
        'order_column' => 0,
    ]);

    $task = Task::create([
        'project_id' => $project->id,
        'group_id' => $group->id,
        'created_by_user_id' => auth()->id(),
        'name' => 'Initial Task',
        'number' => 1,
        'description' => null,
        // pricing_type added by later migration defaults to hourly
        'hidden_from_clients' => false,
        'billable' => true,
        'order_column' => 0,
    ]);

    // Trigger an update to create an audit
    $this->put("/projects/{$project->id}/tasks/{$task->id}", [
        'name' => 'Renamed Task'
    ])->assertOk();

    $this->get("/projects/{$project->id}/tasks/{$task->id}/history")
        ->assertOk()
        ->assertJsonStructure([
            'history' => [
                ['id', 'event', 'old_values', 'new_values', 'created_at']
            ]
        ]);
});

it('restores a task from a selected audit snapshot', function () {
    actingAsAdminWithTaskPermissions();

    $company = ClientCompany::factory()->create();
    $project = Project::create([
        'client_company_id' => $company->id,
        'name' => 'Restore Project',
    ]);

    $group = TaskGroup::create([
        'name' => 'To Do',
        'project_id' => $project->id,
        'order_column' => 0,
    ]);

    $task = Task::create([
        'project_id' => $project->id,
        'group_id' => $group->id,
        'created_by_user_id' => auth()->id(),
        'name' => 'Original Name',
        'number' => 1,
        'hidden_from_clients' => false,
        'billable' => true,
        'order_column' => 0,
    ]);

    // Change the name so we have something to restore
    $this->put("/projects/{$project->id}/tasks/{$task->id}", [
        'name' => 'Second Name'
    ])->assertOk();

    // Fetch history and pick the first (latest) audit that has old_values with 'name'
    $history = $this->get("/projects/{$project->id}/tasks/{$task->id}/history")
        ->assertOk()
        ->json('history');

    // Find the audit where old_values contains the previous name or fall back to created audit
    $audit = collect($history)->first(function ($row) {
        return isset($row['old_values']['name']) || isset($row['new_values']['name']);
    });

    expect($audit)->not->toBeNull();

    $this->post("/projects/{$project->id}/tasks/{$task->id}/history/{$audit['id']}/restore")
        ->assertOk()
        ->assertJsonStructure(['task' => ['id', 'name']]);
});

