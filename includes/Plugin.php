<?php
/**
 * Plugin bootstrap: wires hooks only.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge;

use SchemaForge\Admin\Assets;
use SchemaForge\Admin\EditorAssets;
use SchemaForge\Admin\Menu;
use SchemaForge\Admin\MetaBox;
use SchemaForge\Output\Standalone\Renderer;
use SchemaForge\Output\Yoast\Integration;
use SchemaForge\PostType\TemplatePostType;
use SchemaForge\Rest\AssignmentsController;
use SchemaForge\Rest\PreviewController;
use SchemaForge\Rest\ResolveController;
use SchemaForge\Rest\RulesController;
use SchemaForge\Rest\TemplatesController;
use SchemaForge\Rest\TokensController;
use SchemaForge\Support\Capabilities;

final class Plugin {

	private static ?Plugin $instance = null;

	private bool $booted = false;

	public static function instance(): Plugin {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function boot(): void {
		if ( $this->booted ) {
			return;
		}
		$this->booted = true;

		add_action( 'init', [ $this, 'on_init' ], 5 );
		add_action( 'plugins_loaded', [ $this, 'on_plugins_loaded' ] );
		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );

		if ( is_admin() ) {
			( new Menu() )->register();
			( new Assets() )->register();
			( new MetaBox() )->register();
		}

		( new EditorAssets() )->register();
	}

	public function on_init(): void {
		load_plugin_textdomain( 'schema-forge', false, dirname( SCHEMA_FORGE_BASENAME ) . '/languages' );
		( new TemplatePostType() )->register();
		Capabilities::maybe_upgrade();
	}

	/**
	 * Decide which output adapter to use once all plugins are loaded.
	 */
	public function on_plugins_loaded(): void {
		if ( self::yoast_active() ) {
			( new Integration() )->register();
		} else {
			( new Renderer() )->register();
		}
	}

	public function register_rest_routes(): void {
		( new TemplatesController() )->register_routes();
		( new PreviewController() )->register_routes();
		( new TokensController() )->register_routes();
		( new RulesController() )->register_routes();
		( new AssignmentsController() )->register_routes();
		( new ResolveController() )->register_routes();
	}

	public static function yoast_active(): bool {
		return defined( 'WPSEO_VERSION' ) && class_exists( '\Yoast\WP\SEO\Generators\Schema\Abstract_Schema_Piece' );
	}

	public static function acf_active(): bool {
		return function_exists( 'get_field' ) && function_exists( 'acf_get_field_groups' );
	}
}
