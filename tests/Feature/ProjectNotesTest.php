<?php

use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

it('allows authorized users to list, create, update and delete project notes', function () {
    // Arrange: project and user with permissions
    $company = ClientCompany::factory()->create();
    $project = Project::create([
        'client_company_id' => $company->id,
        'name' => 'Test Project',
    ]);

    $user = User::factory()->create();
    $role = Role::create(['name' => 'admin']);

    foreach (['view notes', 'create note', 'edit note', 'delete note'] as $permName) {
        $perm = Permission::firstOrCreate(['name' => $permName]);
        $role->givePermissionTo($perm);
    }

    $user->assignRole($role);
    Sanctum::actingAs($user);

    // List
    $this->get("/projects/{$project->id}/notes")
        ->assertOk()
        ->assertJsonStructure([
            'notes',
            'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            'can' => ['create', 'edit', 'delete'],
        ]);

    // Create
    $payload = ['content' => 'This is a sample note for the project.'];
    $createRes = $this->post("/projects/{$project->id}/notes", $payload)
        ->assertOk()
        ->json('note');

    expect($createRes['content'])->toBe($payload['content']);

    $noteId = $createRes['id'];

    // Update
    $updatePayload = ['content' => 'Updated project note content.'];
    $this->put("/projects/{$project->id}/notes/{$noteId}", $updatePayload)
        ->assertOk()
        ->assertJsonPath('note.content', $updatePayload['content']);

    // Delete (soft delete)
    $this->delete("/projects/{$project->id}/notes/{$noteId}")
        ->assertOk();

    $this->assertSoftDeleted('project_notes', ['id' => $noteId]);
});
