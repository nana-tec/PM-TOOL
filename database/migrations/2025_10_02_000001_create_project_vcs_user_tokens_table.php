<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_vcs_user_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider'); // github|gitlab
            $table->text('token'); // encrypted cast
            $table->timestamps();
            $table->unique(['project_id', 'user_id', 'provider'], 'project_user_provider_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_vcs_user_tokens');
    }
};
