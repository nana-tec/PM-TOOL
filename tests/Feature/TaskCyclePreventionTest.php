<?php

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

function actingAsAdminForCycle(): User
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

it('prevents setting a task parent to one of its descendants to avoid cycles', function () {
    $user = actingAsAdminForCycle();

    $company = ClientCompany::factory()->create();
    $project = Project::create([
        'client_company_id' => $company->id,
        'name' => 'Cycle Project',
    ]);

    $group = TaskGroup::create([
        'name' => 'To Do',
        'project_id' => $project->id,
        'order_column' => 0,
    ]);

    // Create a simple chain: A -> B -> C
    $taskA = Task::create([
        'project_id' => $project->id,
        'group_id' => $group->id,
        'created_by_user_id' => $user->id,
        'name' => 'A',
        'number' => 1,
        'hidden_from_clients' => false,
        'billable' => true,
        'order_column' => 0,
    ]);

    $taskB = Task::create([
        'project_id' => $project->id,
        'group_id' => $group->id,
        'created_by_user_id' => $user->id,
        'parent_id' => $taskA->id,
        'name' => 'B',
        'number' => 2,
        'hidden_from_clients' => false,
        'billable' => true,
        'order_column' => 1,
    ]);

    $taskC = Task::create([
        'project_id' => $project->id,
        'group_id' => $group->id,
        'created_by_user_id' => $user->id,
        'parent_id' => $taskB->id,
        'name' => 'C',
        'number' => 3,
        'hidden_from_clients' => false,
        'billable' => true,
        'order_column' => 2,
    ]);

    // Attempt to set A's parent to C (which would create a cycle A -> B -> C -> A)
    $this->put(route('projects.tasks.update', [$project->id, $taskA->id]), [
        'parent_id' => $taskC->id,
    ])->assertOk();

    // The update should be ignored due to cycle prevention; A stays root
    expect($taskA->fresh()->parent_id)->toBeNull();
});
