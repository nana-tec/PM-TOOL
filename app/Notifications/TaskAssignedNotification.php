<?php

namespace App\Notifications;

use App\Enums\Queue;
use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskAssignedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Task $task) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database', 'broadcast'];
    }

    /**
     * Determine which queues should be used for each notification channel.
     *
     * @return array<string, string>
     */
    public function viaQueues(): array
    {
        return [
            'mail' => Queue::EMAIL->value,
        ];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("[{$this->task->project->name}] Task {$this->task->name} was assigned to you")
            ->greeting('You have been assigned a new task')
            ->action('Open task', route('projects.tasks.open', ['project' => $this->task->project_id, 'task' => $this->task->id]))
            ->line($this->task->description);
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'task_id' => $this->task->id,
            'title' => "You have been assigned to task {$this->task->name}",
            'subtitle' => "On \"{$this->task->project->name}\" project",
            'link' => route('projects.tasks.open', [$this->task->project_id, $this->task->id]),
            'created_at' => $notifiable->created_at,
            'read_at' => $notifiable->read_at,
        ];
    }
}
