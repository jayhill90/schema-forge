<?php
/**
 * Enqueues the admin app bundle on the Schema Forge screen only.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Admin;

use SchemaForge\Plugin;
use SchemaForge\Support\Capabilities;
use SchemaForge\Vocab\VocabLoader;

final class Assets {

	public function register(): void {
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
	}

	public function enqueue( string $hook ): void {
		if ( $hook !== Menu::hook_suffix() ) {
			return;
		}

		$asset_file = SCHEMA_FORGE_DIR . 'build/admin.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'schema-forge-admin',
			SCHEMA_FORGE_URL . 'build/admin.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);
		wp_set_script_translations( 'schema-forge-admin', 'schema-forge', SCHEMA_FORGE_DIR . 'languages' );

		wp_enqueue_style( 'wp-components' );
		if ( file_exists( SCHEMA_FORGE_DIR . 'build/admin.css' ) ) {
			wp_enqueue_style(
				'schema-forge-admin',
				SCHEMA_FORGE_URL . 'build/admin.css',
				[ 'wp-components' ],
				$asset['version']
			);
		}

		wp_add_inline_script(
			'schema-forge-admin',
			'window.SchemaForgeConfig = ' . wp_json_encode( self::config() ) . ';',
			'before'
		);
	}

	/**
	 * Runtime configuration shared with the admin app.
	 */
	public static function config(): array {
		$post_types = [];
		foreach ( get_post_types( [ 'public' => true ], 'objects' ) as $pt ) {
			if ( $pt->name === 'attachment' ) {
				continue;
			}
			$post_types[] = [
				'name'        => $pt->name,
				'label'       => $pt->labels->name,
				'restBase'    => $pt->rest_base ?: $pt->name,
				'hasArchive'  => (bool) $pt->has_archive,
				'taxonomies'  => array_values( get_object_taxonomies( $pt->name ) ),
			];
		}

		$taxonomies = [];
		foreach ( get_taxonomies( [ 'public' => true ], 'objects' ) as $tax ) {
			$taxonomies[] = [
				'name'     => $tax->name,
				'label'    => $tax->labels->name,
				'restBase' => $tax->rest_base ?: $tax->name,
				'objectTypes' => array_values( (array) $tax->object_type ),
			];
		}

		$vocab_meta = VocabLoader::meta();

		return [
			'restNamespace' => 'schema-forge/v1',
			'restRoot'      => esc_url_raw( rest_url( 'schema-forge/v1' ) ),
			'adminUrl'      => Menu::url(),
			'vocabUrl'      => SCHEMA_FORGE_URL . 'assets/vocab/schemaorg.core.json',
			'vocabDescUrl'  => SCHEMA_FORGE_URL . 'assets/vocab/schemaorg.desc.json',
			'vocabVersion'  => $vocab_meta['version'] ?? '',
			'vocabGenerated'=> $vocab_meta['generated'] ?? '',
			'pluginVersion' => SCHEMA_FORGE_VERSION,
			'postTypes'     => $post_types,
			'taxonomies'    => $taxonomies,
			'hasYoast'      => Plugin::yoast_active(),
			'hasAcf'        => Plugin::acf_active(),
			'siteName'      => get_bloginfo( 'name' ),
			'siteUrl'       => home_url( '/' ),
			'canManage'     => Capabilities::current_user_can(),
			'showOnFront'   => get_option( 'show_on_front' ),
		];
	}
}
