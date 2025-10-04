<?php

namespace App\Enums;

enum Complexity: string
{
    case TRIVIAL = 'trivial';
    case EASY = 'easy';
    case MEDIUM = 'medium';
    case HARD = 'hard';
    case EXTREME = 'extreme';
}
