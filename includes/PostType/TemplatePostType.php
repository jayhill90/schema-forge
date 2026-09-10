<?php
/**
 * Registers the hidden post type that stores schema templates.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\PostType;

use SchemaForge\Support\Capabilities;

final class TemplatePostType {

	public const NAME = 'sf_schema_template';

	public function register(): void {
		if ( post_type_exists( self::NAME ) ) {
			return;
		}

		$cap = Capabilities::cap();

		register_post_type(
			self::NAME,
			[
				'labels'              => [
					'name'          => __( 'Schema Templates', 'schema-forge' ),
					'singular_name' => __( 'Schema Template', 'schema-forge' ),
				],
				'public'              => false,
				'show_ui'             => false,
				'show_in_menu'        => false,
				'show_in_rest'        => false,
				'exclude_from_search' => true,
				'publicly_queryable'  => false,
				'rewrite'             => false,
				'query_var'           => false,
				'hierarchical'        => false,
				'supports'            => [ 'title', 'excerpt', 'author' ],
				'capability_type'     => 'post',
				'map_meta_cap'        => false,
				'capabilities'        => [
					'edit_post'          => $cap,
					'read_post'          => $cap,
					'delete_post'        => $cap,
					'edit_posts'         => $cap,
					'edit_others_posts'  => $cap,
					'publish_posts'      => $cap,
					'read_private_posts' => $cap,
					'delete_posts'       => $cap,
					'create_posts'       => $cap,
				],
			]
		);
	}
}
