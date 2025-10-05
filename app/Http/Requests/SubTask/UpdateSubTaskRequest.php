<?php

namespace App\Http\Requests\SubTask;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSubTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        $task = $this->route('task');
        $project = $this->route('project');

        return $this->user()?->can('update', [$task, $project]) ?? false;
    }

    public function rules(): array
    {
        $task = $this->route('task');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'parent_id' => [
                'nullable',
                Rule::exists('sub_tasks', 'id')->where(fn ($q) => $q->where('task_id', $task->id)),
            ],
            'assigned_to_user_id' => ['nullable', 'exists:users,id'],
            'description' => ['nullable', 'string'],
            'due_on' => ['nullable', 'date'],
            'estimation' => ['nullable', 'numeric', 'min:0'],
            'completed_at' => ['nullable', 'date'],
            'order_column' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
