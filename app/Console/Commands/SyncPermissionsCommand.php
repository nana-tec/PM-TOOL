<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Services\PermissionService;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Permission as SpatiePermission;

class SyncPermissionsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * permissions:sync {role=admin} {--from-config}
     */
    protected $signature = 'permissions:sync {role=admin} {--from-config : Ensure permissions from PermissionService are created before syncing}';

    /**
     * The console command description.
     */
    protected $description = 'Sync all existing permissions to a role (defaults to admin). Optionally create missing permissions from PermissionService before syncing.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        app()['\\Spatie\\Permission\\PermissionRegistrar']->forgetCachedPermissions();

        $roleName = (string) $this->argument('role');
        /** @var Role|null $role */
        $role = Role::whereName($roleName)->first();

        if (! $role) {
            $this->error("Role '{$roleName}' not found.");

            return self::FAILURE;
        }

        if ($this->option('from-config')) {
            // Collect unique permission names from PermissionService config
            $all = collect(PermissionService::$permissionsByRole)
                ->values()
                ->flatMap(fn ($grouped) => collect($grouped)->flatten())
                ->unique()
                ->values();

            $created = 0;
            foreach ($all as $name) {
                $perm = SpatiePermission::where('name', $name)->first();
                if (! $perm) {
                    SpatiePermission::create(['name' => $name, 'guard_name' => 'web']);
                    $created++;
                }
            }

            if ($created > 0) {
                $this->info("Created {$created} permission(s) from config.");
            }
        }

        $allPermissionNames = SpatiePermission::pluck('name')->toArray();
        $role->syncPermissions($allPermissionNames);

        $this->info('Synced '.count($allPermissionNames)." permission(s) to role '{$roleName}'.");

        app()['\\Spatie\\Permission\\PermissionRegistrar']->forgetCachedPermissions();

        return self::SUCCESS;
    }
}
