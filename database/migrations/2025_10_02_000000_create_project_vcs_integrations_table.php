<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_vcs_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('provider'); // github|gitlab
            $table->string('repo'); // github: owner/repo, gitlab: group/project path
            $table->string('base_url')->nullable(); // for self-hosted gitlab; default null means provider default
            $table->string('default_branch')->nullable();
            $table->text('token'); // encrypted via cast on model
            $table->timestamps();
            $table->unique(['project_id', 'provider']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_vcs_integrations');
    }
};
