<?php
/**
 * One Yoast schema graph piece per Schema Forge template.
 *
 * Only loaded when Yoast SEO is active (extends a Yoast class).
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Output\Yoast;

use Yoast\WP\SEO\Generators\Schema\Abstract_Schema_Piece;

final class TemplatePiece extends Abstract_Schema_Piece {

	/** @var array[] */
	private array $nodes;

	public int $template_id;

	/**
	 * @param array[] $nodes
	 */
	public function __construct( int $template_id, array $nodes, $context ) {
		$this->template_id = $template_id;
		$this->nodes       = $nodes;
		$this->context     = $context;
		$this->identifier  = 'schema-forge-' . $template_id;
	}

	public function is_needed() {
		return $this->nodes !== [];
	}

	public function generate() {
		return $this->nodes;
	}
}
