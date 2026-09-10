<?php
/**
 * Activation / deactivation routines.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge;

use SchemaForge\PostType\TemplatePostType;
use SchemaForge\Support\Capabilities;

final class Activation {

	public static function activate(): void {
		Capabilities::grant();
		( new TemplatePostType() )->register();
		update_option( 'schema_forge_version', SCHEMA_FORGE_VERSION );
		flush_rewrite_rules();
	}

	public static function deactivate(): void {
		flush_rewrite_rules();
	}
}
