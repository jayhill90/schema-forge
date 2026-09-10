/**
 * Depth of a node (root = 0).
 */
export function nodeDepth( state, nodeId ) {
	let depth = 0;
	let current = state.nodes[ nodeId ];
	while ( current && current.parentValueId ) {
		const value = state.values[ current.parentValueId ];
		const property = value && state.properties[ value.propertyId ];
		current = property && state.nodes[ property.nodeId ];
		depth += 1;
	}
	return depth;
}

/**
 * All nodes that are placed in the graph (root + placement === 'graph'), for node: references.
 */
export function graphNodes( state ) {
	return Object.values( state.nodes ).filter( ( node ) => node.id === state.rootId || node.options.placement === 'graph' );
}

/**
 * Path of human-readable labels from root to the node.
 */
export function nodePath( state, nodeId ) {
	const path = [];
	let current = state.nodes[ nodeId ];
	while ( current ) {
		path.unshift( current.type );
		if ( ! current.parentValueId ) {
			break;
		}
		const value = state.values[ current.parentValueId ];
		const property = value && state.properties[ value.propertyId ];
		if ( property ) {
			path.unshift( property.name || '?' );
			current = state.nodes[ property.nodeId ];
		} else {
			break;
		}
	}
	return path;
}

export function countNodes( state ) {
	return Object.keys( state.nodes ).length;
}

/**
 * Names already used on a node (to avoid duplicates in the picker).
 */
export function usedPropertyNames( state, nodeId ) {
	const node = state.nodes[ nodeId ];
	if ( ! node ) {
		return [];
	}
	return node.propertyIds.map( ( pid ) => state.properties[ pid ] && state.properties[ pid ].name ).filter( Boolean );
}
