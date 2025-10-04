<?php

use App\Enums\Complexity;
use App\Enums\Priority;
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

function actingAsAdminWithTaskPerms(): User
{
    $user = User::factory()->create();
    $role = Role::firstOrCreate(['name' => 'admin']);

    $perms = [
        'view tasks', 'create task', 'edit task', 'archive task', 'restore task', 'reorder task', 'complete task',
    ];
    foreach ($perms as $permName) {
        $perm = Permission::firstOrCreate(['name' => $permName]);
        $role->givePermissionTo($perm);
    }

    $user->assignRole($role);
    Sanctum::actingAs($user);

    return $user;
}

it('creates a subtask with priority and complexity and preserves relations', function () {
    $user = actingAsAdminWithTaskPerms();

    $company = ClientCompany::factory()->create();
    $project = Project::create([
        'client_company_id' => $company->id,
        'name' => 'Hierarchy Project',
    ]);

    $group = TaskGroup::create([
        'name' => 'Backlog',
        'project_id' => $project->id,
        'order_column' => 0,
    ]);

    $root = Task::create([
        'project_id' => $project->id,
        'group_id' => $group->id,
        'created_by_user_id' => $user->id,
        'name' => 'Root Task',
        'number' => 1,
        'hidden_from_clients' => false,
        'billable' => true,
        'order_column' => 0,
        'priority' => Priority::HIGH,
        'complexity' => Complexity::HARD,
    ]);

    $child = Task::create([
        'project_id' => $project->id,
        'group_id' => $group->id,
        'created_by_user_id' => $user->id,
        'parent_id' => $root->id,
        'name' => 'Child Task',
        'number' => 2,
        'hidden_from_clients' => false,
        'billable' => true,
        'order_column' => 1,
        'priority' => Priority::CRITICAL,
        'complexity' => Complexity::EXTREME,
    ]);

    expect($root->fresh()->children)->toHaveCount(1);
    expect($child->fresh()->parent?->id)->toBe($root->id);

    // Enum casts
    expect($root->priority)->toBeInstanceOf(Priority::class);
    expect($root->priority)->toBe(Priority::HIGH);
    expect($root->complexity)->toBeInstanceOf(Complexity::class);
    expect($root->complexity)->toBe(Complexity::HARD);

    expect($child->priority)->toBe(Priority::CRITICAL);
    expect($child->complexity)->toBe(Complexity::EXTREME);
});
