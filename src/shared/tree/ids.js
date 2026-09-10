let counter = 0;

/**
 * Short unique id with a prefix (n_, p_, v_). Matches the PHP sanitizer's ID_PATTERN.
 *
 * @param {string} prefix
 * @return {string}
 */
export function makeId( prefix ) {
	counter += 1;
	const rand = Math.random().toString( 36 ).slice( 2, 8 );
	return `${ prefix }_${ rand }${ counter.toString( 36 ) }`;
}
