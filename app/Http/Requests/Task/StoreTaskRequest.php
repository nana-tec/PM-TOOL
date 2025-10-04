<?php

namespace App\Http\Requests\Task;

use App\Enums\PricingType;
use App\Enums\Priority;
use App\Enums\Complexity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $project = $this->route('project');

        return [
            'name' => ['required', 'string:255'],
            'group_id' => ['required', 'exists:task_groups,id'],
            'assigned_to_user_id' => ['nullable', 'exists:users,id'],
            'parent_id' => [
                'nullable', 'integer',
                Rule::exists('tasks', 'id')->where(function ($q) use ($project) {
                    if ($project) {
                        $q->where('project_id', $project->id);
                    }
                }),
            ],
            'priority' => ['nullable', 'string', Rule::enum(Priority::class)],
            'complexity' => ['nullable', 'string', Rule::enum(Complexity::class)],
            'description' => ['nullable'],
            'estimation' => ['nullable'],
            'pricing_type' => ['required', 'string', Rule::enum(PricingType::class)],
            'fixed_price' => ['nullable', 'numeric', 'min:0', Rule::when($this->pricing_type === PricingType::FIXED->value, 'present')],
            'due_on' => ['nullable'],
            'hidden_from_clients' => ['required', 'boolean'],
            'billable' => ['required', 'boolean'],
            'subscribed_users' => ['array'],
            'labels' => ['array'],
            'attachments' => ['array'],
        ];
    }
}
