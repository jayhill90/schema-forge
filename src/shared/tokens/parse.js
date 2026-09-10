/**
 * Token grammar shared with includes/Tokens/TokenParser.php — keep the regex identical.
 *
 *   {{namespace.path|filter:arg|filter2}}
 */
export const TOKEN_PATTERN = /\{\{\s*([a-z][a-z0-9_]*)\.([^\s|}]+)\s*(?:\|\s*([^}]*?))?\s*\}\}/gi;

const SINGLE = new RegExp( '^\\s*' + TOKEN_PATTERN.source + '\\s*$', 'i' );

function parseFilters( raw ) {
	const trimmed = ( raw || '' ).trim();
	if ( ! trimmed ) {
		return [];
	}
	return trimmed
		.split( /\|(?=(?:[^"]*"[^"]*")*[^"]*$)/ )
		.map( ( piece ) => piece.trim() )
		.filter( Boolean )
		.map( ( piece ) => {
			const idx = piece.indexOf( ':' );
			if ( idx === -1 ) {
				return { name: piece.toLowerCase(), arg: null };
			}
			let arg = piece.slice( idx + 1 ).trim();
			if ( arg.length >= 2 && arg.startsWith( '"' ) && arg.endsWith( '"' ) ) {
				arg = arg.slice( 1, -1 );
			}
			return { name: piece.slice( 0, idx ).trim().toLowerCase(), arg };
		} );
}

/**
 * @param {string} text
 * @return {Array<{match:string,namespace:string,path:string,filters:Array<{name:string,arg:string|null}>,index:number}>}
 */
export function parseTokens( text ) {
	if ( typeof text !== 'string' || ! text.includes( '{{' ) ) {
		return [];
	}
	const out = [];
	const re = new RegExp( TOKEN_PATTERN.source, 'gi' );
	let m;
	while ( ( m = re.exec( text ) ) !== null ) {
		out.push( {
			match: m[ 0 ],
			namespace: m[ 1 ].toLowerCase(),
			path: m[ 2 ],
			filters: parseFilters( m[ 3 ] ),
			index: m.index,
		} );
	}
	return out;
}

export function hasTokens( text ) {
	return parseTokens( text ).length > 0;
}

export function isSingleToken( text ) {
	return typeof text === 'string' && SINGLE.test( text );
}

/**
 * Split text into literal and token segments for highlighting.
 *
 * @param {string} text
 * @return {Array<{type:'text'|'token', value:string, token?:object}>}
 */
export function segmentText( text ) {
	const tokens = parseTokens( text );
	if ( ! tokens.length ) {
		return text ? [ { type: 'text', value: text } ] : [];
	}
	const segments = [];
	let cursor = 0;
	for ( const token of tokens ) {
		if ( token.index > cursor ) {
			segments.push( { type: 'text', value: text.slice( cursor, token.index ) } );
		}
		segments.push( { type: 'token', value: token.match, token } );
		cursor = token.index + token.match.length;
	}
	if ( cursor < text.length ) {
		segments.push( { type: 'text', value: text.slice( cursor ) } );
	}
	return segments;
}
