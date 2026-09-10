<?php
/**
 * Resolves and compiles every template that applies to a page.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Output;

use SchemaForge\Assignment\AssignmentResolver;
use SchemaForge\Compiler\NodeCompiler;
use SchemaForge\Model\RenderContext;
use SchemaForge\Model\Template;
use SchemaForge\Repository\TemplateRepository;

final class GraphBuilder {

	/** @var array<string, GraphResult> */
	private static array $memo = [];

	/**
	 * Build the graph for the page described by the context (memoized per request).
	 */
	public static function for_context( RenderContext $ctx ): GraphResult {
		$key = $ctx->query->kind . '|' . $ctx->query->post_id . '|' . $ctx->query->term_id . '|' . $ctx->canonical;
		if ( ! isset( self::$memo[ $key ] ) ) {
			$ids               = AssignmentResolver::resolve( $ctx->query );
			self::$memo[ $key ] = self::build( $ids, $ctx );
		}
		return self::$memo[ $key ];
	}

	/**
	 * Compile a specific list of templates (already ordered).
	 *
	 * @param int[]|Template[] $templates
	 */
	public static function build( array $templates, RenderContext $ctx, bool $collect_tokens = false ): GraphResult {
		$repo   = TemplateRepository::instance();
		$queue  = [];
		foreach ( $templates as $template ) {
			if ( $template instanceof Template ) {
				$queue[] = $template;
			} else {
				$found = $repo->find( (int) $template );
				if ( $found && $found->enabled ) {
					$queue[] = $found;
				}
			}
		}

		$result   = new GraphResult();
		$compiler = new NodeCompiler( null, $collect_tokens );
		$done     = [];

		while ( $queue ) {
			$template = array_shift( $queue );
			if ( $template->id > 0 && isset( $done[ $template->id ] ) ) {
				continue;
			}
			$done[ $template->id ] = true;

			$compiled = $compiler->compile( $template, $ctx );
			$result->nodes_by_template[ $template->id ] = $compiled->nodes;
			$result->template_ids[]                     = $template->id;
			$result->warnings                           = array_merge( $result->warnings, $compiled->warnings );
			$result->tokens                             = $result->tokens + $compiled->tokens;

			if ( $compiled->nodes === [] ) {
				// A template that produced nothing must not influence the page either.
				continue;
			}
			if ( $compiled->main_entity_id && $result->main_entity_id === null ) {
				$result->main_entity_id = $compiled->main_entity_id;
			}
			if ( $template->setting( 'yoast.suppressArticle' ) ) {
				$result->suppress_article = true;
			}
			$page_type = (string) $template->setting( 'yoast.webPageType', '' );
			if ( $page_type !== '' && $result->webpage_type === '' ) {
				$result->webpage_type = $page_type;
			}

			foreach ( $compiled->dependencies as $dep_id ) {
				if ( ! isset( $done[ $dep_id ] ) ) {
					$dep = $repo->find( $dep_id );
					if ( $dep && $dep->enabled ) {
						$queue[] = $dep;
					}
				}
			}
		}

		return $result;
	}

	public static function reset(): void {
		self::$memo = [];
	}
}
