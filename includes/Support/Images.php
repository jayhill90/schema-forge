<?php
/**
 * ImageObject helpers.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Support;

final class Images {

	/**
	 * Build a schema.org ImageObject array from an attachment.
	 */
	public static function object_from_attachment( int $attachment_id, string $id = '' ): ?array {
		if ( $attachment_id <= 0 || ! wp_attachment_is_image( $attachment_id ) ) {
			return null;
		}
		$url = wp_get_attachment_image_url( $attachment_id, 'full' );
		if ( ! $url ) {
			return null;
		}
		$node = [
			'@type'      => 'ImageObject',
			'url'        => $url,
			'contentUrl' => $url,
		];
		if ( $id !== '' ) {
			$node = [ '@type' => 'ImageObject', '@id' => $id ] + $node;
		}
		$meta = wp_get_attachment_metadata( $attachment_id );
		if ( is_array( $meta ) && ! empty( $meta['width'] ) && ! empty( $meta['height'] ) ) {
			$node['width']  = (int) $meta['width'];
			$node['height'] = (int) $meta['height'];
		}
		$caption = wp_get_attachment_caption( $attachment_id );
		if ( $caption ) {
			$node['caption'] = wp_strip_all_tags( $caption );
		}
		return $node;
	}
}
