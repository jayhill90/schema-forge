/**
 * Client-side vocabulary helpers over assets/vocab/schemaorg.core.json.
 * The shapes mirror scripts/lib/compile-vocab.mjs.
 */

const inheritedCache = new WeakMap();
const ancestorCache = new WeakMap();

function cacheFor( map, core ) {
	let entry = map.get( core );
	if ( ! entry ) {
		entry = new Map();
		map.set( core, entry );
	}
	return entry;
}

export function hasType( core, name ) {
	return Boolean( core && core.types && core.types[ name ] );
}

export function getType( core, name ) {
	return ( core && core.types && core.types[ name ] ) || null;
}

export function getProperty( core, name ) {
	return ( core && core.props && core.props[ name ] ) || null;
}

/**
 * Ancestors of a type, breadth first.
 *
 * @param {Object} core Compiled vocabulary.
 * @param {string} name Type name.
 * @return {string[]} Ancestors, nearest first.
 */
export function getAncestors( core, name ) {
	if ( ! core ) {
		return [];
	}
	const cache = cacheFor( ancestorCache, core );
	if ( cache.has( name ) ) {
		return cache.get( name );
	}
	const out = [];
	const seen = new Set();
	const queue = [ name ];
	while ( queue.length ) {
		const current = queue.shift();
		const type = core.types[ current ];
		if ( ! type ) {
			continue;
		}
		for ( const parent of type.s ) {
			if ( ! seen.has( parent ) ) {
				seen.add( parent );
				out.push( parent );
				queue.push( parent );
			}
		}
	}
	cache.set( name, out );
	return out;
}

export function isSubtypeOf( core, child, parent ) {
	if ( child === parent ) {
		return true;
	}
	return getAncestors( core, child ).includes( parent );
}

/**
 * Direct + inherited properties, sorted; deprecated ones last.
 *
 * @param {Object} core     Compiled vocabulary.
 * @param {string} typeName Type name.
 * @return {Array<{name:string, own:boolean, from:string, deprecated:boolean, replacedBy:string[], extension:boolean}>} Properties with their origin.
 */
export function getAllProperties( core, typeName ) {
	if ( ! core ) {
		return [];
	}
	const cache = cacheFor( inheritedCache, core );
	if ( cache.has( typeName ) ) {
		return cache.get( typeName );
	}
	const map = new Map();
	const flags = ( p ) => {
		const prop = core.props[ p ] || {};
		return {
			deprecated: Boolean( prop.x ),
			replacedBy: prop.sb || [],
			extension: Boolean( prop.ext ),
		};
	};
	const type = core.types[ typeName ];
	if ( type ) {
		type.p.forEach( ( p ) =>
			map.set( p, { name: p, own: true, from: typeName, ...flags( p ) } )
		);
	}
	for ( const ancestor of getAncestors( core, typeName ) ) {
		const a = core.types[ ancestor ];
		if ( ! a ) {
			continue;
		}
		a.p.forEach( ( p ) => {
			if ( ! map.has( p ) ) {
				map.set( p, {
					name: p,
					own: false,
					from: ancestor,
					...flags( p ),
				} );
			}
		} );
	}
	// Deprecated properties sort last so live ones stay easy to reach.
	const out = [ ...map.values() ].sort(
		( a, b ) =>
			a.deprecated - b.deprecated || a.name.localeCompare( b.name )
	);
	cache.set( typeName, out );
	return out;
}

export function getRange( core, propertyName ) {
	const prop = getProperty( core, propertyName );
	return prop ? prop.r : [];
}

export function isSuperseded( core, name ) {
	const type = getType( core, name );
	return Boolean( type && type.x );
}

export function supersededBy( core, name ) {
	const type = getType( core, name );
	if ( type && type.sb ) {
		return type.sb;
	}
	const prop = getProperty( core, name );
	return ( prop && prop.sb ) || [];
}

export function isPropertySuperseded( core, name ) {
	const prop = getProperty( core, name );
	return Boolean( prop && prop.x );
}

export function isDataType( core, name ) {
	return Boolean( core && core.datatypes && core.datatypes.includes( name ) );
}

export function isEnumeration( core, name ) {
	const type = getType( core, name );
	return Boolean( type && type.e );
}

export function getEnumMembers( core, name ) {
	return ( core && core.enums && core.enums[ name ] ) || [];
}

/**
 * Non-datatype range types a nested node may use for a property.
 *
 * @param {Object} core         Compiled vocabulary.
 * @param {string} propertyName Property name.
 * @return {string[]} Expected node types.
 */
export function getNodeRange( core, propertyName ) {
	return getRange( core, propertyName ).filter(
		( r ) => ! isDataType( core, r )
	);
}

/**
 * Does `typeName` satisfy the property's expected range? Empty/Thing ranges accept anything.
 *
 * @param {Object} core         Compiled vocabulary.
 * @param {string} propertyName Property name.
 * @param {string} typeName     Candidate nested type.
 * @return {boolean} True when the type fits.
 */
export function typeFitsProperty( core, propertyName, typeName ) {
	const range = getNodeRange( core, propertyName );
	if ( ! range.length || range.includes( 'Thing' ) ) {
		return true;
	}
	return range.some( ( r ) => isSubtypeOf( core, typeName, r ) );
}

/**
 * Suggested dataType for the property editor from its range.
 *
 * @param {Object} core         Compiled vocabulary.
 * @param {string} propertyName Property name.
 * @return {string} One of the ValueCoercer data types (`auto`, `url`, `number`…).
 */
export function suggestDataType( core, propertyName ) {
	const range = getRange( core, propertyName );
	if ( ! range.length ) {
		return 'auto';
	}
	const has = ( t ) => range.includes( t );
	if ( has( 'Text' ) ) {
		return 'auto';
	}
	if ( has( 'URL' ) ) {
		return 'url';
	}
	if ( has( 'DateTime' ) ) {
		return 'datetime';
	}
	if ( has( 'Date' ) ) {
		return 'date';
	}
	if ( has( 'Integer' ) ) {
		return 'integer';
	}
	if ( has( 'Number' ) || has( 'Float' ) ) {
		return 'number';
	}
	if ( has( 'Boolean' ) ) {
		return 'boolean';
	}
	return 'auto';
}

/**
 * Top-level ancestor used to group the palette (Thing's direct children).
 *
 * @param {Object} core     Compiled vocabulary.
 * @param {string} typeName Type name.
 * @return {string} Group label.
 */
export function getGroup( core, typeName ) {
	const ancestors = getAncestors( core, typeName );
	if ( ! ancestors.length ) {
		return typeName === 'Thing' ? 'Thing' : 'Other';
	}
	const idx = ancestors.indexOf( 'Thing' );
	if ( idx === -1 ) {
		return ancestors[ ancestors.length - 1 ];
	}
	return idx === 0 ? typeName : ancestors[ idx - 1 ];
}

/**
 * Rank types for the palette search. Prefix > word start > substring > ancestor match.
 *
 * @param {Object}  core                        Compiled vocabulary.
 * @param {string}  query                       Search text.
 * @param {Object}  [options]
 * @param {number}  [options.limit]             Maximum results (default 50).
 * @param {boolean} [options.includePending]    Include pending schema.org terms (default true).
 * @param {boolean} [options.excludeDataTypes]  Hide Text, URL, Number… (default true).
 * @param {boolean} [options.includeSuperseded] Include deprecated types, ranked last (default true).
 * @return {string[]} Matching type names, best first.
 */
export function searchTypes(
	core,
	query,
	{
		limit = 50,
		includePending = true,
		excludeDataTypes = true,
		includeSuperseded = true,
	} = {}
) {
	if ( ! core ) {
		return [];
	}
	const q = ( query || '' ).trim().toLowerCase();
	const names = Object.keys( core.types );
	const scored = [];
	for ( const name of names ) {
		const t = core.types[ name ];
		if (
			excludeDataTypes &&
			( isDataType( core, name ) || name === 'DataType' )
		) {
			continue;
		}
		if ( ! includePending && t.pd ) {
			continue;
		}
		if ( ! includeSuperseded && t.x ) {
			continue;
		}
		const penalty = t.x ? 50 : 0; // deprecated types rank below live ones
		if ( ! q ) {
			scored.push( [ name, 0 - penalty ] );
			continue;
		}
		const lower = name.toLowerCase();
		let score = -1;
		if ( lower === q ) {
			score = 100;
		} else if ( lower.startsWith( q ) ) {
			score = 80;
		} else if (
			/[A-Z]/.test( name.slice( 1 ) ) &&
			name
				.split( /(?=[A-Z])/ )
				.some( ( w ) => w.toLowerCase().startsWith( q ) )
		) {
			score = 60;
		} else if ( lower.includes( q ) ) {
			score = 40;
		} else if (
			getAncestors( core, name ).some( ( a ) => a.toLowerCase() === q )
		) {
			score = 20;
		}
		if ( score >= 0 ) {
			scored.push( [ name, score - penalty - name.length / 100 ] );
		}
	}
	scored.sort(
		( a, b ) => b[ 1 ] - a[ 1 ] || a[ 0 ].localeCompare( b[ 0 ] )
	);
	return scored.slice( 0, limit ).map( ( [ name ] ) => name );
}

/**
 * Rank properties of a type for the property combobox.
 *
 * @param {Object} core     Compiled vocabulary.
 * @param {string} typeName Type whose properties are searched.
 * @param {string} query    Search text.
 * @param {number} [limit]  Maximum results (default 40).
 * @return {Array<{name:string, own:boolean, from:string}>} Matching properties, best first.
 */
export function searchProperties( core, typeName, query, limit = 40 ) {
	const all = getAllProperties( core, typeName );
	const q = ( query || '' ).trim().toLowerCase();
	if ( ! q ) {
		return all.slice( 0, limit );
	}
	return all
		.map( ( p ) => {
			const lower = p.name.toLowerCase();
			let score = -1;
			if ( lower === q ) {
				score = 100;
			} else if ( lower.startsWith( q ) ) {
				score = 80;
			} else if ( lower.includes( q ) ) {
				score = 40;
			}
			return [ p, score ];
		} )
		.filter( ( [ , s ] ) => s >= 0 )
		.sort(
			( a, b ) =>
				b[ 1 ] - a[ 1 ] || a[ 0 ].name.localeCompare( b[ 0 ].name )
		)
		.slice( 0, limit )
		.map( ( [ p ] ) => p );
}
