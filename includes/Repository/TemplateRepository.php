<?php
/**
 * Loads and stores templates (sf_schema_template posts).
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Repository;

use SchemaForge\Model\Template;
use SchemaForge\PostType\TemplatePostType;
use SchemaForge\Support\Json;

final class TemplateRepository {

	public const META_TREE     = '_sf_tree';
	public const META_SETTINGS = '_sf_settings';

	private static ?TemplateRepository $instance = null;

	/** @var array<int, Template|null> */
	private array $cache = [];

	public static function instance(): self {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function find( int $id ): ?Template {
		if ( array_key_exists( $id, $this->cache ) ) {
			return $this->cache[ $id ];
		}
		$post = $id > 0 ? get_post( $id ) : null;
		if ( ! $post instanceof \WP_Post || $post->post_type !== TemplatePostType::NAME || $post->post_status === 'trash' ) {
			$this->cache[ $id ] = null;
			return null;
		}
		$this->cache[ $id ] = $this->hydrate( $post );
		return $this->cache[ $id ];
	}

	/**
	 * @param bool|null $enabled Filter by enabled state; null for all.
	 * @return Template[]
	 */
	public function all( ?bool $enabled = null ): array {
		$status = $enabled === null ? [ 'publish', 'draft' ] : ( $enabled ? 'publish' : 'draft' );
		$posts  = get_posts(
			[
				'post_type'        => TemplatePostType::NAME,
				'post_status'      => $status,
				'numberposts'      => -1,
				'orderby'          => 'title',
				'order'            => 'ASC',
				'suppress_filters' => false,
				'no_found_rows'    => true,
			]
		);
		$out = [];
		foreach ( $posts as $post ) {
			$template               = $this->hydrate( $post );
			$this->cache[ $post->ID ] = $template;
			$out[]                  = $template;
		}
		return $out;
	}

	/**
	 * @return array<int, Template> Enabled templates keyed by id, in the given order.
	 */
	public function find_many( array $ids, bool $only_enabled = true ): array {
		$out = [];
		foreach ( $ids as $id ) {
			$template = $this->find( (int) $id );
			if ( $template && ( ! $only_enabled || $template->enabled ) ) {
				$out[ $template->id ] = $template;
			}
		}
		return $out;
	}

	/**
	 * Insert or update. Returns the template id.
	 *
	 * @throws \RuntimeException When WordPress refuses the write.
	 */
	public function save( Template $template ): int {
		$args = [
			'post_type'    => TemplatePostType::NAME,
			'post_title'   => $template->name !== '' ? $template->name : __( 'Untitled template', 'schema-forge' ),
			'post_excerpt' => $template->description,
			'post_status'  => $template->enabled ? 'publish' : 'draft',
			'post_content' => '',
		];
		if ( $template->id > 0 ) {
			$args['ID'] = $template->id;
			$result     = wp_update_post( wp_slash( $args ), true );
		} else {
			$result = wp_insert_post( wp_slash( $args ), true );
		}
		if ( is_wp_error( $result ) ) {
			throw new \RuntimeException( $result->get_error_message() );
		}
		$id = (int) $result;
		update_post_meta( $id, self::META_TREE, wp_slash( Json::encode( $template->tree ) ) );
		update_post_meta( $id, self::META_SETTINGS, wp_slash( Json::encode( $template->settings ) ) );
		unset( $this->cache[ $id ] );
		$this->bump_cache_version();
		return $id;
	}

	public function delete( int $id ): bool {
		$template = $this->find( $id );
		if ( ! $template ) {
			return false;
		}
		$deleted = wp_delete_post( $id, true );
		unset( $this->cache[ $id ] );
		$this->bump_cache_version();
		return (bool) $deleted;
	}

	public function duplicate( int $id ): ?Template {
		$source = $this->find( $id );
		if ( ! $source ) {
			return null;
		}
		$copy = new Template(
			0,
			sprintf( /* translators: %s template name */ __( '%s (copy)', 'schema-forge' ), $source->name ),
			$source->description,
			false,
			$source->tree,
			$source->settings
		);
		$new_id = $this->save( $copy );
		return $this->find( $new_id );
	}

	private function hydrate( \WP_Post $post ): Template {
		$defaults = Template::defaults();
		$tree     = Json::decode( (string) get_post_meta( $post->ID, self::META_TREE, true ) );
		$settings = Json::decode( (string) get_post_meta( $post->ID, self::META_SETTINGS, true ) );
		return new Template(
			(int) $post->ID,
			wp_specialchars_decode( $post->post_title, ENT_QUOTES ),
			$post->post_excerpt,
			$post->post_status === 'publish',
			is_array( $tree ) ? $tree : $defaults['tree'],
			is_array( $settings ) ? array_replace_recursive( $defaults['settings'], $settings ) : $defaults['settings'],
			(string) get_post_modified_time( 'Y-m-d H:i:s', true, $post ),
			(string) get_post_time( 'Y-m-d H:i:s', true, $post )
		);
	}

	/**
	 * Cache-busting version, used by output adapters.
	 */
	public static function cache_version(): int {
		return (int) get_option( 'schema_forge_cache_version', 1 );
	}

	private function bump_cache_version(): void {
		update_option( 'schema_forge_cache_version', self::cache_version() + 1, false );
	}
}
