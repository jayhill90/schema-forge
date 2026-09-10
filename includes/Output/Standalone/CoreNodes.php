<?php
/**
 * Minimal base graph when Yoast SEO is not active.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Output\Standalone;

use SchemaForge\Model\RenderContext;
use SchemaForge\Support\Images;
use SchemaForge\Support\Settings;
use SchemaForge\Tokens\Providers\PostProvider;

final class CoreNodes {

	/**
	 * @return array[]
	 */
	public static function build( RenderContext $ctx, ?string $main_entity_id, string $webpage_type = '' ): array {
		$settings = Settings::get();
		$nodes    = [];

		$publisher_id = null;
		if ( $settings['siteRepresents'] === 'organization' ) {
			$publisher_id = $ctx->site_url . '#organization';
			$org          = [
				'@type' => 'Organization',
				'@id'   => $publisher_id,
				'name'  => $settings['organizationName'] ?: $ctx->site_name,
				'url'   => $ctx->site_url,
			];
			$logo_id = (int) ( $settings['organizationLogo'] ?: $ctx->site_logo_id );
			if ( $logo_id ) {
				$logo = Images::object_from_attachment( $logo_id, $ctx->site_url . '#/schema/logo/image/' );
				if ( $logo ) {
					$org['logo']  = $logo;
					$org['image'] = [ '@id' => $logo['@id'] ];
				}
			}
			$nodes[] = $org;
		} elseif ( $settings['siteRepresents'] === 'person' ) {
			$user_id = (int) $settings['personUserId'];
			$user    = $user_id ? get_userdata( $user_id ) : null;
			if ( $user ) {
				$publisher_id = $ctx->site_url . '#/schema/person/site';
				$person       = [
					'@type' => 'Person',
					'@id'   => $publisher_id,
					'name'  => $user->display_name,
					'url'   => get_author_posts_url( $user_id ),
				];
				$avatar = get_avatar_url( $user_id, [ 'size' => 512 ] );
				if ( $avatar ) {
					$person['image'] = [
						'@type' => 'ImageObject',
						'url'   => $avatar,
					];
				}
				$nodes[] = $person;
			}
		}

		$website = [
			'@type'           => 'WebSite',
			'@id'             => $ctx->website_id(),
			'url'             => $ctx->site_url,
			'name'            => $ctx->site_name,
			'potentialAction' => [
				[
					'@type'       => 'SearchAction',
					'target'      => [
						'@type'       => 'EntryPoint',
						'urlTemplate' => home_url( '/?s={search_term_string}' ),
					],
					'query-input' => 'required name=search_term_string',
				],
			],
			'inLanguage'      => get_bloginfo( 'language' ),
		];
		if ( $ctx->site_description ) {
			$website['description'] = $ctx->site_description;
		}
		if ( $publisher_id ) {
			$website['publisher'] = [ '@id' => $publisher_id ];
		}
		$nodes[] = $website;

		$primary_image = null;
		if ( $ctx->main_image_id ) {
			$primary_image = Images::object_from_attachment( $ctx->main_image_id, $ctx->webpage_id() . '#primaryimage' );
		}

		$webpage = [
			'@type'    => $webpage_type !== '' ? $webpage_type : 'WebPage',
			'@id'      => $ctx->webpage_id(),
			'url'      => $ctx->canonical,
			'name'     => self::page_title( $ctx ),
			'isPartOf' => [ '@id' => $ctx->website_id() ],
		];
		if ( $ctx->post ) {
			$webpage['datePublished'] = get_post_time( 'c', true, $ctx->post );
			$webpage['dateModified']  = get_post_modified_time( 'c', true, $ctx->post );
			$excerpt                  = PostProvider::excerpt( $ctx->post );
			if ( $excerpt ) {
				$webpage['description'] = $excerpt;
			}
		}
		if ( $primary_image ) {
			$webpage['primaryImageOfPage'] = [ '@id' => $primary_image['@id'] ];
			$webpage['image']              = [ '@id' => $primary_image['@id'] ];
			$webpage['thumbnailUrl']       = $primary_image['url'];
		}
		if ( $main_entity_id ) {
			$webpage['mainEntity'] = [ '@id' => $main_entity_id ];
		}
		$webpage['inLanguage'] = get_bloginfo( 'language' );
		$nodes[]               = $webpage;

		if ( $primary_image ) {
			$nodes[] = $primary_image;
		}

		return $nodes;
	}

	private static function page_title( RenderContext $ctx ): string {
		if ( $ctx->post ) {
			return wp_specialchars_decode( (string) get_the_title( $ctx->post ), ENT_QUOTES );
		}
		if ( $ctx->term ) {
			return wp_specialchars_decode( $ctx->term->name, ENT_QUOTES );
		}
		return $ctx->site_name;
	}
}
