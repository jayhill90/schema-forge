<?php
/**
 * GET /resolve — which templates apply to a post, and why.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Rest;

use SchemaForge\Assignment\AssignmentResolver;
use SchemaForge\Assignment\PostAssignments;
use SchemaForge\Assignment\QueryContext;
use SchemaForge\Repository\TemplateRepository;
use SchemaForge\Support\Capabilities;

final class ResolveController extends AbstractController {

	public function register_routes(): void {
		$this->register(
			'/resolve',
			\WP_REST_Server::READABLE,
			[ $this, 'resolve' ],
			[
				'post_id'   => [ 'type' => 'integer', 'default' => 0 ],
				'kind'      => [ 'type' => 'string', 'default' => '' ],
				'post_type' => [ 'type' => 'string', 'default' => '' ],
				'term_id'   => [ 'type' => 'integer', 'default' => 0 ],
			],
			[ $this, 'resolve_permission' ]
		);
	}

	public function resolve_permission( \WP_REST_Request $request ): bool|\WP_Error {
		$post_id = (int) $request['post_id'];
		if ( Capabilities::current_user_can() || ( $post_id && current_user_can( 'edit_post', $post_id ) ) ) {
			return true;
		}
		return $this->error( 'schema_forge_forbidden', __( 'Not allowed.', 'schema-forge' ), rest_authorization_required_code() );
	}

	public function resolve( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = (int) $request['post_id'];
		$qc      = $post_id > 0
			? QueryContext::for_post( $post_id )
			: QueryContext::for_archive( (string) $request['kind'], sanitize_key( (string) $request['post_type'] ), (int) $request['term_id'] );

		$repo    = TemplateRepository::instance();
		$entries = [];
		foreach ( AssignmentResolver::resolve_with_sources( $qc ) as $entry ) {
			$template = $repo->find( $entry['id'] );
			if ( $template ) {
				$entries[] = $entry + [ 'name' => $template->name, 'rootType' => $template->root_type() ];
			}
		}

		// Also report inherited-but-disabled ones for the editor UI.
		$disabled = [];
		if ( $post_id > 0 ) {
			$assignments = PostAssignments::get( $post_id );
			foreach ( $assignments['disable'] as $id ) {
				$template = $repo->find( $id );
				if ( $template ) {
					$disabled[] = [ 'id' => $id, 'name' => $template->name, 'rootType' => $template->root_type() ];
				}
			}
		}

		$available = array_map(
			static fn( $t ) => [ 'id' => $t->id, 'name' => $t->name, 'rootType' => $t->root_type() ],
			$repo->all( true )
		);

		return rest_ensure_response(
			[
				'resolved'  => $entries,
				'disabled'  => $disabled,
				'available' => array_values( $available ),
			]
		);
	}
}
