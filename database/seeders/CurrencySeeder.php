<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Intl\Currencies;

class CurrencySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get all currency names (code => name) in English for consistency
        $names = Currencies::getNames('en');

        foreach ($names as $code => $name) {
            // Ensure ISO 4217 3-letter codes only
            if (! is_string($code) || strlen($code) !== 3) {
                continue;
            }

            // Obtain a symbol for the currency (fallback to code if missing)
            $symbol = Currencies::getSymbol($code, 'en') ?? $code;
            // Enforce DB column limit (5) with multibyte safety
            if (function_exists('mb_substr')) {
                $symbol = mb_substr($symbol, 0, 5, 'UTF-8');
            } else {
                $symbol = substr($symbol, 0, 5);
            }

            // Number of fraction digits (e.g. 0 for JPY, 2 for USD)
            $decimals = Currencies::getFractionDigits($code);
            if ($decimals === null || $decimals < 0 || $decimals > 6) {
                $decimals = 2;
            }

            DB::table('currencies')->updateOrInsert(
                ['code' => $code],
                [
                    'name' => $name,
                    'symbol' => $symbol,
                    'decimals' => $decimals,
                ]
            );
        }
    }
}
