<?php

namespace App\Models;

use App\Enums\Complexity;
use App\Enums\Priority;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subtask extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id',
        'created_by_user_id',
        'assigned_to_user_id',
        'name',
        'description',
        'due_on',
        'estimation',
        'priority',
        'complexity',
        'order_column',
        'completed_at',
    ];

    protected $casts = [
        'due_on' => 'date',
        'completed_at' => 'datetime',
        'estimation' => 'float',
        'priority' => Priority::class,
        'complexity' => Complexity::class,
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function assignedToUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }
}

