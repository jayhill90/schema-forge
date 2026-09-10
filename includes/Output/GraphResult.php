<?php
/**
 * Compiled graph for one page.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Output;

final class GraphResult {

	/**
	 * @param array<int, array[]> $nodes_by_template Template id → nodes.
	 * @param int[]               $template_ids      Output order.
	 * @param string[]            $warnings
	 */
	public function __construct(
		public array $nodes_by_template = [],
		public array $template_ids = [],
		public ?string $main_entity_id = null,
		public bool $suppress_article = false,
		public string $webpage_type = '',
		public array $warnings = [],
		public array $tokens = [],
	) {}

	/**
	 * All nodes, deduplicated by @id (first wins).
	 *
	 * @return array[]
	 */
	public function nodes(): array {
		$seen = [];
		$out  = [];
		foreach ( $this->template_ids as $id ) {
			foreach ( $this->nodes_by_template[ $id ] ?? [] as $node ) {
				$node_id = $node['@id'] ?? null;
				if ( $node_id !== null ) {
					if ( isset( $seen[ $node_id ] ) ) {
						continue;
					}
					$seen[ $node_id ] = true;
				}
				$out[] = $node;
			}
		}
		return $out;
	}

	public function is_empty(): bool {
		return $this->nodes() === [];
	}
}
