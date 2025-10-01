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
        'span' => [],
        'h1' => [],
        'h2' => [],
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

        // Remove doctype and html/body wrappers
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

            // Remove event handler and style/class attributes
            $allowedAttrs = $this->allowedTags[$tag];
            for ($i = $node->attributes->length - 1; $i >= 0; $i--) {
                $attr = $node->attributes->item($i);
                $name = strtolower($attr->nodeName);
                if (str_starts_with($name, 'on') || $name === 'style' || $name === 'class') {
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
                        // enforce safe link attrs
                        $node->setAttribute('rel', 'nofollow noopener noreferrer');
                        $node->setAttribute('target', '_blank');
                    }
                }
            }
        }

        // Recurse
        if ($node->hasChildNodes()) {
            for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
                $this->sanitizeNode($node->childNodes->item($i));
            }
        }
    }

    private function isSafeHref(string $href): bool
    {
        // allow http, https, mailto only
        $lower = strtolower($href);
        return str_starts_with($lower, 'http://') || str_starts_with($lower, 'https://') || str_starts_with($lower, 'mailto:');
    }
}
