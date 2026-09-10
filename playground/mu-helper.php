<?php
/**
 * Playground-only helper: registers a `product` post type and `product_cat`
 * taxonomy (no WooCommerce needed) plus a classic-editor `catalog_item` type
 * so both the block-editor sidebar and the classic meta box can be exercised.
 */

add_action(
	'init',
	static function () {
		register_post_type(
			'product',
			[
				'label'        => 'Products',
				'public'       => true,
				'has_archive'  => true,
				'show_in_rest' => true,
				'supports'     => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields' ],
				'taxonomies'   => [ 'product_cat' ],
				'menu_icon'    => 'dashicons-cart',
			]
		);
		register_taxonomy(
			'product_cat',
			'product',
			[
				'label'        => 'Product categories',
				'public'       => true,
				'hierarchical' => true,
				'show_in_rest' => true,
			]
		);
		register_post_type(
			'catalog_item',
			[
				'label'        => 'Catalog Items',
				'public'       => true,
				'has_archive'  => true,
				'show_in_rest' => false,
				'supports'     => [ 'title', 'editor' ],
			]
		);
	},
	1
);

/**
 * Playground-only convenience: auto-login as admin for wp-admin / wp-login requests.
 * Playground's own --login only works on the very first request, which breaks after restarts.
 */
add_action(
	'init',
	static function () {
		if ( is_user_logged_in() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
		if ( ! str_contains( $uri, '/wp-admin' ) && ! str_contains( $uri, 'wp-login.php' ) ) {
			return;
		}
		wp_set_auth_cookie( 1, true );
		wp_set_current_user( 1 );
		$target = admin_url( 'admin.php?page=schema-forge' );
		if ( str_contains( $uri, 'wp-login.php' ) && ! empty( $_GET['redirect_to'] ) ) {
			$target = wp_validate_redirect( wp_unslash( $_GET['redirect_to'] ), $target );
		} elseif ( str_contains( $uri, '/wp-admin' ) ) {
			$target = home_url( $uri );
		}
		wp_safe_redirect( $target );
		exit;
	},
	0
);
