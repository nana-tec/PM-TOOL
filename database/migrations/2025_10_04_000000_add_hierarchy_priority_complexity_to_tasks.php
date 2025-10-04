<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('invoice_id')->constrained('tasks')->nullOnDelete();
            $table->string('priority', 20)->nullable()->after('billable');
            $table->string('complexity', 20)->nullable()->after('priority');
            $table->index('parent_id');
            $table->index('priority');
            $table->index('complexity');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn(['priority', 'complexity']);
        });
    }
};
