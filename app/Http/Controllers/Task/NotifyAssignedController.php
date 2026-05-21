<?php

namespace App\Http\Controllers\Task;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\User;
use App\Models\Project;
use App\Notifications\TaskAssignedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NotifyAssignedController extends Controller
{
    public function notify(Request $request, Project $project, Task $task)
    {
        /* $this->authorize('view', $task); */

        $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['exists:users,id'],
        ]);

        $users = User::whereIn('id', $request->user_ids)->get();

        if ($users->isEmpty()) {
            return response()->json(['message' => 'No valid users selected'], 422);
        }

        $users->each(fn(User $user) => $user->notify(new TaskAssignedNotification($task)));

        return redirect()->back();
    }
}
