<?php
/**
 * Resolves `ref` values to {"@id": ...} objects.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Compiler;

use SchemaForge\Model\RenderContext;
use SchemaForge\Output\Yoast\YoastReferences;
use SchemaForge\Repository\TemplateRepository;

final class ReferenceResolver {

	public const YOAST_TARGETS = [ 'webpage', 'website', 'organization', 'person', 'publisher', 'primaryimage', 'breadcrumb', 'author', 'article' ];

	/**
	 * @param array<string,string> $node_ids Map of nodeId → @id for graph-placed nodes in the current template.
	 * @param int[]                $dependencies Template ids referenced (collected by reference).
	 */
	public static function resolve( string $target, RenderContext $ctx, array $node_ids, array &$dependencies ): ?array {
		[ $kind, $value ] = array_pad( explode( ':', $target, 2 ), 2, '' );

		switch ( $kind ) {
			case 'yoast':
			case 'core':
				$id = self::core_id( $value, $ctx );
				return $id ? [ '@id' => $id ] : null;

			case 'node':
				return isset( $node_ids[ $value ] ) ? [ '@id' => $node_ids[ $value ] ] : null;

			case 'template':
				$template_id = (int) $value;
				if ( $template_id <= 0 || $template_id === $ctx->template_id ) {
					return null;
				}
				$template = TemplateRepository::instance()->find( $template_id );
				if ( ! $template || ! $template->enabled || $template->root_type() === '' ) {
					return null;
				}
				if ( ! in_array( $template_id, $dependencies, true ) ) {
					$dependencies[] = $template_id;
				}
				return [ '@id' => IdGenerator::root( $ctx, $template->root_type(), $template_id ) ];
		}
		return null;
	}

	/**
	 * Id of a core entity, from Yoast when active or from the standalone core nodes otherwise.
	 */
	public static function core_id( string $entity, RenderContext $ctx ): ?string {
		if ( $ctx->yoast ) {
			return YoastReferences::id( $entity, $ctx );
		}
		$settings   = get_option( 'schema_forge_settings', [] );
		$represents = is_array( $settings ) ? (string) ( $settings['siteRepresents'] ?? 'organization' ) : 'organization';
		switch ( $entity ) {
			case 'webpage':
				return $ctx->webpage_id();
			case 'website':
				return $ctx->website_id();
			case 'organization':
				return $represents === 'organization' ? $ctx->site_url . '#organization' : null;
			case 'person':
				return $represents === 'person' ? $ctx->site_url . '#/schema/person/site' : null;
			case 'publisher':
				return $represents === 'person' ? $ctx->site_url . '#/schema/person/site' : ( $represents === 'organization' ? $ctx->site_url . '#organization' : null );
			case 'primaryimage':
				return $ctx->main_image_id ? $ctx->webpage_id() . '#primaryimage' : null;
			case 'author':
				return $ctx->post && $ctx->post->post_author ? $ctx->site_url . '#/schema/person/' . md5( (string) $ctx->post->post_author ) : null;
			case 'breadcrumb':
			case 'article':
				return null; // Not emitted in standalone mode.
		}
		return null;
	}
}
