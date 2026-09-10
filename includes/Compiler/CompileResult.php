<?php
/**
 * Result of compiling one template.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Compiler;

final class CompileResult {

	/**
	 * @param array[]  $nodes         Graph nodes produced.
	 * @param string[] $warnings
	 * @param int[]    $dependencies  Other template ids referenced via template: refs.
	 * @param array<string, mixed> $tokens Token → resolved preview value (only when collecting).
	 */
	public function __construct(
		public array $nodes = [],
		public ?string $main_entity_id = null,
		public array $warnings = [],
		public array $dependencies = [],
		public array $tokens = [],
	) {}
}
