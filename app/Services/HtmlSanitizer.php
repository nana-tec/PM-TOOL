<?php

namespace App\Services;

use DOMDocument;
use DOMElement;

class HtmlSanitizer
{
    /** @var array<string, array<string>> */
    private array $allowedTags = [
        'a' => ['href', 'rel', 'target'],
        'b' => [],
        'strong' => [],
        'i' => [],
        'em' => [],
        'u' => [],
        's' => [],
        'ul' => [],
        'ol' => [],
        'li' => [],
        'blockquote' => [],
        'code' => [],
        'p' => [],
        'br' => [],
        'span' => ['class'],
        'h1' => [],
        'h2' => [],
        'h3' => [],
        'hr' => [],
    ];

    public function sanitize(?string $html): string
    {
        if ($html === null || trim($html) === '') {
            return '';
        }

        $doc = new DOMDocument();
        $internalErrors = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($internalErrors);

        $this->sanitizeNode($doc->documentElement ?? $doc);

        $output = '';
        foreach ($doc->childNodes as $child) {
            $output .= $doc->saveHTML($child);
        }

        return $output ?? '';
    }

    private function sanitizeNode($node): void
    {
        if ($node instanceof DOMElement) {
            $tag = strtolower($node->tagName);
            if (! array_key_exists($tag, $this->allowedTags)) {
                $node->parentNode?->removeChild($node);
                return;
            }

            $allowedAttrs = $this->allowedTags[$tag];
            for ($i = $node->attributes->length - 1; $i >= 0; $i--) {
                $attr = $node->attributes->item($i);
                $name = strtolower($attr->nodeName);

                // Drop event handlers and style attributes always
                if (str_starts_with($name, 'on') || $name === 'style') {
                    $node->removeAttribute($attr->nodeName);
                    continue;
                }

                // Special-case: only allow class="mention" on span
                if ($name === 'class') {
                    if ($tag === 'span' && trim((string) $attr->nodeValue) === 'mention') {
                        continue; // keep class=mention
                    }
                    $node->removeAttribute($attr->nodeName);
                    continue;
                }

                if (! in_array($name, $allowedAttrs, true)) {
                    $node->removeAttribute($attr->nodeName);
                    continue;
                }

                if ($tag === 'a' && $name === 'href') {
                    $href = trim((string) $attr->nodeValue);
                    if (! $this->isSafeHref($href)) {
                        $node->removeAttribute('href');
                    } else {
                        $node->setAttribute('rel', 'nofollow noopener noreferrer');
                        $node->setAttribute('target', '_blank');
                    }
                }
            }
        }

        if ($node->hasChildNodes()) {
            for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
                $this->sanitizeNode($node->childNodes->item($i));
            }
        }
    }

    private function isSafeHref(string $href): bool
    {
        $lower = strtolower($href);
        return str_starts_with($lower, 'http://') || str_starts_with($lower, 'https://') || str_starts_with($lower, 'mailto:');
    }
}
