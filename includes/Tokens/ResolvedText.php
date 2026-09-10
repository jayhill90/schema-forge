<?php
/**
 * Result of resolving a text value.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens;

final class ResolvedText {

	public function __construct(
		public mixed $value,
		public bool $had_tokens,
		public bool $any_empty,
		public bool $structured,
	) {}

	public function is_empty(): bool {
		return TokenResolver::is_empty( $this->value );
	}
}
