<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\EloquentSortable\Sortable;
use Spatie\EloquentSortable\SortableTrait;

class SubTask extends Model implements Sortable
{
    use HasFactory, SortableTrait;

    protected $table = 'sub_tasks';

    protected $fillable = [
        'task_id',
        'parent_id',
        'assigned_to_user_id',
        'name',
        'description',
        'due_on',
        'estimation',
        'order_column',
        'completed_at',
    ];

    protected $casts = [
        'due_on' => 'date',
        'completed_at' => 'datetime',
        'estimation' => 'float',
    ];

    public $sortable = [
        'order_column_name' => 'order_column',
        'sort_when_creating' => true,
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(SubTask::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(SubTask::class, 'parent_id')->orderBy('order_column');
    }

    public function assignedToUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }
}
