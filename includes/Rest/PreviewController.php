<?php
/**
 * POST /preview — compile an unsaved template against a real post or archive.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Rest;

use SchemaForge\Model\RenderContext;
use SchemaForge\Model\Template;
use SchemaForge\Output\GraphBuilder;
use SchemaForge\Output\Standalone\Renderer;
use SchemaForge\Plugin;
use SchemaForge\Support\TemplateSanitizer;

final class PreviewController extends AbstractController {

	public function register_routes(): void {
		$this->register( '/preview', \WP_REST_Server::CREATABLE, [ $this, 'preview' ] );
	}

	public function preview( \WP_REST_Request $request ) {
		$body     = $request->get_json_params() ?: [];
		$defaults = Template::defaults();

		try {
			$clean = ( new TemplateSanitizer() )->sanitize( $body['tree'] ?? $defaults['tree'], $body['settings'] ?? $defaults['settings'] );
		} catch ( \InvalidArgumentException $e ) {
			return $this->error( 'schema_forge_invalid_template', $e->getMessage(), 400 );
		}

		$ctx = self::context_from_request( (array) ( $body['context'] ?? [] ) );
		if ( ! $ctx ) {
			return $this->error( 'schema_forge_invalid_context', __( 'Choose a post or archive to preview against.', 'schema-forge' ), 400 );
		}

		$template = new Template( (int) ( $body['id'] ?? 0 ), 'Preview', '', true, $clean['tree'], $clean['settings'] );
		if ( $template->id <= 0 ) {
			$template->id = 0;
		}
		$result = GraphBuilder::build( [ $template ], $ctx, true );

		$nodes = $result->nodes();
		$graph = [
			'@context' => 'https://schema.org',
			'@graph'   => $nodes,
		];
		$full_graph = null;
		if ( ! Plugin::yoast_active() ) {
			$full_graph = Renderer::graph( $result, $ctx );
		}

		return rest_ensure_response(
			[
				'graph'      => $graph,
				'fullGraph'  => $full_graph,
				'warnings'   => array_values( array_unique( array_merge( $clean['warnings'], $result->warnings ) ) ),
				'tokens'     => $result->tokens,
				'mainEntity' => $result->main_entity_id,
				'context'    => [
					'kind'      => $ctx->query->kind,
					'postId'    => $ctx->post_id(),
					'canonical' => $ctx->canonical,
					'title'     => $ctx->post ? get_the_title( $ctx->post ) : ( $ctx->term ? $ctx->term->name : '' ),
					'yoast'     => (bool) $ctx->yoast,
				],
			]
		);
	}

	public static function context_from_request( array $context ): ?RenderContext {
		$post_id = (int) ( $context['postId'] ?? 0 );
		if ( $post_id > 0 ) {
			$post = get_post( $post_id );
			if ( ! $post || ! current_user_can( 'read_post', $post_id ) ) {
				return null;
			}
			return RenderContext::for_post( $post_id );
		}
		$kind = (string) ( $context['kind'] ?? '' );
		if ( $kind !== '' && $kind !== 'singular' ) {
			return RenderContext::for_archive( $kind, sanitize_key( (string) ( $context['postType'] ?? '' ) ), (int) ( $context['termId'] ?? 0 ) );
		}
		return null;
	}
}
