<?php

namespace App\Actions\Task;

use App\Enums\PricingType;
use App\Events\Task\TaskUpdated;
use App\Models\Task;

class UpdateTask
{
    public function update(Task $task, array $data): void
    {
        $updateField = key($data);

        if ($updateField === 'parent_id') {
            $newParentId = isset($data['parent_id']) ? (int) $data['parent_id'] : null;

            // Prevent assigning the task as its own parent
            if ($newParentId !== null && $newParentId === (int) $task->id) {
                unset($data['parent_id']);
            } elseif ($newParentId !== null) {
                // Prevent cycles: walk up the ancestor chain from the candidate parent
                $ancestorId = $newParentId;
                $hops = 0;
                while ($ancestorId !== null && $hops < 100) { // safety upper bound
                    if ($ancestorId === (int) $task->id) {
                        // Cycle detected, drop update
                        unset($data['parent_id']);
                        break;
                    }
                    $ancestor = Task::query()->find($ancestorId, ['id', 'parent_id']);
                    $ancestorId = $ancestor?->parent_id ? (int) $ancestor->parent_id : null;
                    $hops++;
                }
            }
        }

        if ($updateField === 'pricing_type' && $data['pricing_type'] === PricingType::HOURLY->value) {
            $task->update([
                'pricing_type' => PricingType::HOURLY,
                'fixed_price' => null,
            ]);
        }

        if ($updateField === 'fixed_price' && isset($data['fixed_price'])) {
            $data['fixed_price'] = (int) $data['fixed_price'];
        }

        if (! in_array($updateField, ['subscribed_users', 'labels'])) {
            if (! empty($data)) {
                $task->update($data);

                if ($updateField === 'group_id') {
                    $task->update(['order_column' => 0]);
                }
            }
        }

        if ($updateField === 'subscribed_users') {
            $task->subscribedUsers()->sync($data['subscribed_users']);
        }

        if ($updateField === 'labels') {
            $task->labels()->sync($data['labels']);
        }

        TaskUpdated::dispatch($task, $updateField);
    }
}
