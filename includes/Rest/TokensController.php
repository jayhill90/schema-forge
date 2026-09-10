<?php
/**
 * GET /tokens — token catalog for the picker.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Rest;

use SchemaForge\Model\RenderContext;
use SchemaForge\Tokens\TokenResolver;

final class TokensController extends AbstractController {

	public function register_routes(): void {
		$this->register(
			'/tokens',
			\WP_REST_Server::READABLE,
			[ $this, 'index' ],
			[
				'post_id'   => [ 'type' => 'integer', 'default' => 0 ],
				'post_type' => [ 'type' => 'string', 'default' => '' ],
				'kind'      => [ 'type' => 'string', 'default' => '' ],
				'term_id'   => [ 'type' => 'integer', 'default' => 0 ],
			]
		);
	}

	public function index( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = (int) $request['post_id'];
		if ( $post_id > 0 && get_post( $post_id ) ) {
			$ctx = RenderContext::for_post( $post_id );
		} elseif ( (string) $request['kind'] !== '' ) {
			$ctx = RenderContext::for_archive( (string) $request['kind'], sanitize_key( (string) $request['post_type'] ), (int) $request['term_id'] );
		} else {
			$post_type = sanitize_key( (string) $request['post_type'] ) ?: 'post';
			$sample    = get_posts(
				[
					'post_type'   => $post_type,
					'numberposts' => 1,
					'post_status' => 'publish',
					'fields'      => 'ids',
				]
			);
			$ctx = $sample ? RenderContext::for_post( (int) $sample[0] ) : RenderContext::for_archive( 'post_type_archive', $post_type );
			if ( ! $sample ) {
				$ctx->query->post_type = $post_type;
			}
		}
		return rest_ensure_response( TokenResolver::instance()->catalog( $ctx ) );
	}
}
