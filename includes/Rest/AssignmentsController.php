<?php
/**
 * /posts/{id}/assignments — per-post overrides.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Rest;

use SchemaForge\Assignment\PostAssignments;
use SchemaForge\Support\Capabilities;

final class AssignmentsController extends AbstractController {

	public function register_routes(): void {
		$this->register( '/posts/(?P<id>\d+)/assignments', \WP_REST_Server::READABLE, [ $this, 'show' ], [], [ $this, 'post_permission' ] );
		$this->register( '/posts/(?P<id>\d+)/assignments', 'PUT, POST', [ $this, 'update' ], [], [ $this, 'post_permission' ] );
	}

	/**
	 * Editors of the post OR schema managers may change its assignments.
	 */
	public function post_permission( \WP_REST_Request $request ): bool|\WP_Error {
		$post_id = (int) $request['id'];
		if ( ! get_post( $post_id ) ) {
			return $this->error( 'schema_forge_not_found', __( 'Post not found.', 'schema-forge' ), 404 );
		}
		if ( Capabilities::current_user_can() || current_user_can( 'edit_post', $post_id ) ) {
			return true;
		}
		return $this->error( 'schema_forge_forbidden', __( 'You cannot edit this post.', 'schema-forge' ), rest_authorization_required_code() );
	}

	public function show( \WP_REST_Request $request ): \WP_REST_Response {
		return rest_ensure_response( PostAssignments::get( (int) $request['id'] ) );
	}

	public function update( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params();
		return rest_ensure_response( PostAssignments::save( (int) $request['id'], is_array( $body ) ? $body : [] ) );
	}
}
