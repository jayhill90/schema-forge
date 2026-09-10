<?php
/**
 * Admin menu + app mount point.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Admin;

use SchemaForge\Support\Capabilities;

final class Menu {

	public const SLUG = 'schema-forge';

	public function register(): void {
		add_action( 'admin_menu', [ $this, 'add_menu' ] );
	}

	public function add_menu(): void {
		add_menu_page(
			__( 'Schema Forge', 'schema-forge' ),
			__( 'Schema', 'schema-forge' ),
			Capabilities::cap(),
			self::SLUG,
			[ $this, 'render' ],
			'dashicons-networking',
			81
		);
	}

	public function render(): void {
		echo '<div class="wrap schema-forge-wrap"><div id="schema-forge-admin" class="schema-forge-app">';
		echo '<p class="schema-forge-loading" role="status">' . esc_html__( 'Loading Schema Forge…', 'schema-forge' ) . '</p>';
		echo '</div></div>';
	}

	public static function hook_suffix(): string {
		return 'toplevel_page_' . self::SLUG;
	}

	public static function url( array $args = [] ): string {
		return add_query_arg( array_merge( [ 'page' => self::SLUG ], $args ), admin_url( 'admin.php' ) );
	}
}
