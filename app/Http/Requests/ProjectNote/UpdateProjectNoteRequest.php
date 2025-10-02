<?php

namespace App\Http\Requests\ProjectNote;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProjectNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'content' => ['required', 'min:8'],
        ];
    }
}
