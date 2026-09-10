<?php
/**
 * {{post.*}} tokens.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens\Providers;

use SchemaForge\Model\RenderContext;
use SchemaForge\Support\Images;
use SchemaForge\Tokens\ProviderInterface;

final class PostProvider implements ProviderInterface {

	public function namespace(): string {
		return 'post';
	}

	public function label(): string {
		return __( 'Post', 'schema-forge' );
	}

	public function resolve( string $path, RenderContext $ctx ): mixed {
		$post = $ctx->post;
		if ( ! $post ) {
			return null;
		}

		switch ( $path ) {
			case 'id':
				return (int) $post->ID;
			case 'title':
				return wp_specialchars_decode( (string) get_the_title( $post ), ENT_QUOTES );
			case 'slug':
				return $post->post_name;
			case 'type':
				return $post->post_type;
			case 'type_label':
				$obj = get_post_type_object( $post->post_type );
				return $obj ? $obj->labels->singular_name : $post->post_type;
			case 'status':
				return $post->post_status;
			case 'excerpt':
				return self::excerpt( $post );
			case 'content':
				return trim( (string) apply_filters( 'schema_forge_post_content_html', $post->post_content, $post ) );
			case 'content_text':
				return self::plain_text( $post->post_content );
			case 'word_count':
				return str_word_count( self::plain_text( $post->post_content ) );
			case 'permalink':
			case 'url':
				return (string) get_permalink( $post );
			case 'date':
				return get_post_time( 'c', true, $post );
			case 'modified':
				return get_post_modified_time( 'c', true, $post );
			case 'featured_image':
				$id = (int) get_post_thumbnail_id( $post );
				return $id ? (string) wp_get_attachment_image_url( $id, 'full' ) : null;
			case 'featured_image_object':
				$id = (int) get_post_thumbnail_id( $post );
				return $id ? Images::object_from_attachment( $id ) : null;
			case 'comment_count':
				return (int) $post->comment_count;
			case 'parent.title':
				return $post->post_parent ? wp_specialchars_decode( (string) get_the_title( $post->post_parent ), ENT_QUOTES ) : null;
			case 'parent.permalink':
				return $post->post_parent ? (string) get_permalink( $post->post_parent ) : null;
		}

		if ( str_starts_with( $path, 'author.' ) ) {
			return self::author( substr( $path, 7 ), (int) $post->post_author );
		}

		return null;
	}

	private static function author( string $field, int $user_id ): mixed {
		if ( ! $user_id ) {
			return null;
		}
		switch ( $field ) {
			case 'id':
				return $user_id;
			case 'name':
				return get_the_author_meta( 'display_name', $user_id ) ?: null;
			case 'first_name':
				return get_the_author_meta( 'first_name', $user_id ) ?: null;
			case 'last_name':
				return get_the_author_meta( 'last_name', $user_id ) ?: null;
			case 'url':
				return (string) get_author_posts_url( $user_id );
			case 'website':
				return get_the_author_meta( 'user_url', $user_id ) ?: null;
			case 'description':
				return get_the_author_meta( 'description', $user_id ) ?: null;
			case 'avatar':
				return get_avatar_url( $user_id, [ 'size' => 512 ] ) ?: null;
		}
		return null;
	}

	public static function excerpt( \WP_Post $post ): ?string {
		if ( $post->post_excerpt !== '' ) {
			return self::plain_text( $post->post_excerpt );
		}
		$text = self::plain_text( $post->post_content );
		return $text === '' ? null : wp_trim_words( $text, 55, '…' );
	}

	public static function plain_text( string $content ): string {
		$content = strip_shortcodes( $content );
		$content = excerpt_remove_blocks( $content );
		$content = wp_strip_all_tags( $content, true );
		$content = html_entity_decode( $content, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		return trim( preg_replace( '/\s+/u', ' ', $content ) ?? $content );
	}

	public function catalog( RenderContext $ctx ): array {
		$t = static fn( string $path, string $label, string $type = 'text', string $desc = '' ) => [
			'token'       => "{{post.$path}}",
			'label'       => $label,
			'type'        => $type,
			'description' => $desc,
		];
		return [
			$t( 'title', __( 'Title', 'schema-forge' ) ),
			$t( 'excerpt', __( 'Excerpt', 'schema-forge' ), 'text', __( 'Manual excerpt, or the first 55 words of content.', 'schema-forge' ) ),
			$t( 'content_text', __( 'Content (plain text)', 'schema-forge' ) ),
			$t( 'content', __( 'Content (HTML)', 'schema-forge' ) ),
			$t( 'permalink', __( 'Permalink', 'schema-forge' ), 'url' ),
			$t( 'featured_image', __( 'Featured image URL', 'schema-forge' ), 'url' ),
			$t( 'featured_image_object', __( 'Featured image (ImageObject)', 'schema-forge' ), 'object' ),
			$t( 'date', __( 'Published date', 'schema-forge' ), 'datetime' ),
			$t( 'modified', __( 'Modified date', 'schema-forge' ), 'datetime' ),
			$t( 'author.name', __( 'Author name', 'schema-forge' ) ),
			$t( 'author.url', __( 'Author archive URL', 'schema-forge' ), 'url' ),
			$t( 'author.website', __( 'Author website', 'schema-forge' ), 'url' ),
			$t( 'author.description', __( 'Author bio', 'schema-forge' ) ),
			$t( 'author.avatar', __( 'Author avatar URL', 'schema-forge' ), 'url' ),
			$t( 'id', __( 'Post ID', 'schema-forge' ), 'number' ),
			$t( 'slug', __( 'Slug', 'schema-forge' ) ),
			$t( 'type', __( 'Post type', 'schema-forge' ) ),
			$t( 'word_count', __( 'Word count', 'schema-forge' ), 'number' ),
			$t( 'comment_count', __( 'Comment count', 'schema-forge' ), 'number' ),
			$t( 'parent.title', __( 'Parent title', 'schema-forge' ) ),
			$t( 'parent.permalink', __( 'Parent permalink', 'schema-forge' ), 'url' ),
		];
	}
}
