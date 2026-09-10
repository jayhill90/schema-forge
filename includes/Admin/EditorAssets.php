<?php
/**
 * Enqueues the block editor sidebar panel.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Admin;

use SchemaForge\Support\Capabilities;

final class EditorAssets {

	public function register(): void {
		add_action( 'enqueue_block_editor_assets', [ $this, 'enqueue' ] );
	}

	public function enqueue(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || empty( $screen->post_type ) ) {
			return;
		}
		$post_type = get_post_type_object( $screen->post_type );
		if ( ! $post_type || ! $post_type->public || $screen->post_type === 'attachment' ) {
			return;
		}
		$asset_file = SCHEMA_FORGE_DIR . 'build/editor.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;
		wp_enqueue_script( 'schema-forge-editor', SCHEMA_FORGE_URL . 'build/editor.js', $asset['dependencies'], $asset['version'], true );
		wp_set_script_translations( 'schema-forge-editor', 'schema-forge', SCHEMA_FORGE_DIR . 'languages' );
		if ( file_exists( SCHEMA_FORGE_DIR . 'build/editor.css' ) ) {
			wp_enqueue_style( 'schema-forge-editor', SCHEMA_FORGE_URL . 'build/editor.css', [], $asset['version'] );
		}
		wp_add_inline_script(
			'schema-forge-editor',
			'window.SchemaForgeEditor = ' . wp_json_encode(
				[
					'adminUrl'  => Capabilities::current_user_can() ? Menu::url() : '',
					'canManage' => Capabilities::current_user_can(),
				]
			) . ';',
			'before'
		);
	}
}
