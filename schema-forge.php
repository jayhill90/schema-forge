<?php
/**
 * Plugin Name:       Schema Forge
 * Plugin URI:        https://github.com/jayhill90/schema-forge
 * Description:       Drag-and-drop schema.org template builder. Build reusable structured-data templates and assign them to posts, post types, terms and archives. Integrates with Yoast SEO's schema graph.
 * Version:           0.1.0
 * Requires at least: 6.6
 * Requires PHP:      8.1
 * Author:            Jay Hill
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       schema-forge
 * Domain Path:       /languages
 *
 * @package SchemaForge
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SCHEMA_FORGE_VERSION', '0.1.0' );
define( 'SCHEMA_FORGE_FILE', __FILE__ );
define( 'SCHEMA_FORGE_DIR', plugin_dir_path( __FILE__ ) );
define( 'SCHEMA_FORGE_URL', plugin_dir_url( __FILE__ ) );
define( 'SCHEMA_FORGE_BASENAME', plugin_basename( __FILE__ ) );

require_once SCHEMA_FORGE_DIR . 'includes/Autoloader.php';
SchemaForge\Autoloader::register();

register_activation_hook( __FILE__, [ SchemaForge\Activation::class, 'activate' ] );
register_deactivation_hook( __FILE__, [ SchemaForge\Activation::class, 'deactivate' ] );

SchemaForge\Plugin::instance()->boot();
