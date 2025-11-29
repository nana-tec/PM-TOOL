<?php

namespace App\Http\Resources\Project;

use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'favorite' => $this->favorite,
            'client_company' => $this->clientCompany->only(['id', 'name']),
            'users_with_access' => PermissionService::usersWithAccessToProject($this),
            'all_tasks_count' => $this->all_tasks_count,
            'completed_tasks_count' => $this->completed_tasks_count,
            'overdue_tasks_count' => $this->overdue_tasks_count,
            'parent_id' => $this->parent_id,
            'children_count' => $this->whenLoaded('children', fn () => $this->children->count()),
            'children' => $this->whenLoaded('children', fn () => $this->serializeChildren($this->children)),
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, \App\Models\Project>  $children
     * @return array<int, array<string, mixed>>
     */
    protected function serializeChildren($children): array
    {
        return $children->map(function ($child) {
            return [
                'id' => $child->id,
                'name' => $child->name,
                'parent_id' => $child->parent_id,
                'children_count' => $child->relationLoaded('children') ? $child->children->count() : 0,
                'tasks_count' => method_exists($child, 'tasks') ? $child->tasks()->count() : 0,
                'children' => $child->relationLoaded('children')
                    ? $this->serializeChildren($child->children)
                    : [],
            ];
        })->toArray();
    }
}
