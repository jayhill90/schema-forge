import { makeId } from './ids';

export const DEFAULT_NODE_OPTIONS = {
	isMainEntity: false,
	idOverride: '',
	placement: 'inline',
	extraTypes: [],
	collapsed: false,
};

export const DEFAULT_PROPERTY = {
	dataType: 'auto',
	onEmpty: 'drop',
	fallback: '',
};

export function emptyState() {
	return { rootId: null, nodes: {}, properties: {}, values: {} };
}

/**
 * Convert a stored tree ({ version, root }) into normalized tables.
 *
 * @param {object|null} tree
 * @return {{rootId:string|null,nodes:object,properties:object,values:object}}
 */
export function normalize( tree ) {
	const state = emptyState();
	const root = tree && tree.root;
	if ( ! root || ! root.type ) {
		return state;
	}
	state.rootId = addNode( state, root, null, true );
	return state;
}

function addNode( state, node, parentValueId, isRoot ) {
	const id = node.id || makeId( 'n' );
	state.nodes[ id ] = {
		id,
		type: node.type || 'Thing',
		options: {
			...DEFAULT_NODE_OPTIONS,
			...( node.options || {} ),
			placement: isRoot ? 'graph' : ( node.options && node.options.placement ) || 'inline',
			extraTypes: [ ...( ( node.options && node.options.extraTypes ) || [] ) ],
		},
		propertyIds: [],
		parentValueId,
	};
	for ( const property of node.properties || [] ) {
		state.nodes[ id ].propertyIds.push( addProperty( state, property, id ) );
	}
	return id;
}

function addProperty( state, property, nodeId ) {
	const id = property.id || makeId( 'p' );
	state.properties[ id ] = {
		id,
		name: property.name || '',
		dataType: property.dataType || DEFAULT_PROPERTY.dataType,
		onEmpty: property.onEmpty || DEFAULT_PROPERTY.onEmpty,
		fallback: property.fallback || '',
		valueIds: [],
		nodeId,
	};
	for ( const value of property.values || [] ) {
		state.properties[ id ].valueIds.push( addValue( state, value, id ) );
	}
	return id;
}

function addValue( state, value, propertyId ) {
	const id = value.id || makeId( 'v' );
	const kind = value.kind || 'text';
	const entry = { id, kind, propertyId };
	if ( kind === 'text' ) {
		entry.value = value.value || '';
		entry.allowPartial = Boolean( value.allowPartial );
	} else if ( kind === 'ref' ) {
		entry.target = value.target || '';
	} else if ( kind === 'node' || kind === 'repeat' ) {
		if ( kind === 'repeat' ) {
			entry.source = value.source || '';
		}
		entry.nodeId = value.node && value.node.type ? addNode( state, value.node, id, false ) : null;
	}
	state.values[ id ] = entry;
	return id;
}

/**
 * Convert normalized tables back into the stored tree shape.
 */
export function denormalize( state ) {
	return {
		version: 1,
		root: state.rootId ? nodeToTree( state, state.rootId, true ) : null,
	};
}

function nodeToTree( state, nodeId, isRoot ) {
	const node = state.nodes[ nodeId ];
	if ( ! node ) {
		return null;
	}
	return {
		id: node.id,
		type: node.type,
		options: {
			...node.options,
			placement: isRoot ? 'graph' : node.options.placement,
			extraTypes: [ ...node.options.extraTypes ],
		},
		properties: node.propertyIds
			.map( ( pid ) => propertyToTree( state, pid ) )
			.filter( Boolean ),
	};
}

function propertyToTree( state, propertyId ) {
	const property = state.properties[ propertyId ];
	if ( ! property ) {
		return null;
	}
	return {
		id: property.id,
		name: property.name,
		dataType: property.dataType,
		onEmpty: property.onEmpty,
		fallback: property.fallback,
		values: property.valueIds.map( ( vid ) => valueToTree( state, vid ) ).filter( Boolean ),
	};
}

function valueToTree( state, valueId ) {
	const value = state.values[ valueId ];
	if ( ! value ) {
		return null;
	}
	switch ( value.kind ) {
		case 'text':
			return { id: value.id, kind: 'text', value: value.value, allowPartial: Boolean( value.allowPartial ) };
		case 'ref':
			return { id: value.id, kind: 'ref', target: value.target };
		case 'node':
			return { id: value.id, kind: 'node', node: value.nodeId ? nodeToTree( state, value.nodeId, false ) : null };
		case 'repeat':
			return { id: value.id, kind: 'repeat', source: value.source, node: value.nodeId ? nodeToTree( state, value.nodeId, false ) : null };
		default:
			return null;
	}
}

/**
 * Ids of every node/property/value inside a subtree (inclusive).
 */
export function collectSubtree( state, nodeId, acc = { nodes: [], properties: [], values: [] } ) {
	const node = state.nodes[ nodeId ];
	if ( ! node ) {
		return acc;
	}
	acc.nodes.push( nodeId );
	for ( const pid of node.propertyIds ) {
		const property = state.properties[ pid ];
		if ( ! property ) {
			continue;
		}
		acc.properties.push( pid );
		for ( const vid of property.valueIds ) {
			const value = state.values[ vid ];
			if ( ! value ) {
				continue;
			}
			acc.values.push( vid );
			if ( value.nodeId ) {
				collectSubtree( state, value.nodeId, acc );
			}
		}
	}
	return acc;
}
