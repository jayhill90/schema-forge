import { makeId } from './ids';
import {
	DEFAULT_NODE_OPTIONS,
	DEFAULT_PROPERTY,
	collectSubtree,
	emptyState,
	normalize,
} from './normalize';

export const ACTIONS = {
	LOAD: 'LOAD',
	SET_ROOT_TYPE: 'SET_ROOT_TYPE',
	SET_NODE_TYPE: 'SET_NODE_TYPE',
	SET_NODE_OPTION: 'SET_NODE_OPTION',
	ADD_PROPERTY: 'ADD_PROPERTY',
	UPDATE_PROPERTY: 'UPDATE_PROPERTY',
	REMOVE_PROPERTY: 'REMOVE_PROPERTY',
	MOVE_PROPERTY: 'MOVE_PROPERTY',
	ADD_VALUE: 'ADD_VALUE',
	UPDATE_VALUE: 'UPDATE_VALUE',
	REMOVE_VALUE: 'REMOVE_VALUE',
	MOVE_VALUE: 'MOVE_VALUE',
	NEST_NODE: 'NEST_NODE',
	CLEAR_NODE: 'CLEAR_NODE',
};

export const actions = {
	load: ( tree ) => ( { type: ACTIONS.LOAD, tree } ),
	setRootType: ( typeName, id ) => ( {
		type: ACTIONS.SET_ROOT_TYPE,
		typeName,
		id,
	} ),
	setNodeType: ( nodeId, typeName ) => ( {
		type: ACTIONS.SET_NODE_TYPE,
		nodeId,
		typeName,
	} ),
	setNodeOption: ( nodeId, key, value ) => ( {
		type: ACTIONS.SET_NODE_OPTION,
		nodeId,
		key,
		value,
	} ),
	addProperty: ( nodeId, name, extra = {} ) => ( {
		type: ACTIONS.ADD_PROPERTY,
		nodeId,
		name,
		...extra,
	} ),
	updateProperty: ( propertyId, patch ) => ( {
		type: ACTIONS.UPDATE_PROPERTY,
		propertyId,
		patch,
	} ),
	removeProperty: ( propertyId ) => ( {
		type: ACTIONS.REMOVE_PROPERTY,
		propertyId,
	} ),
	moveProperty: ( nodeId, from, to ) => ( {
		type: ACTIONS.MOVE_PROPERTY,
		nodeId,
		from,
		to,
	} ),
	addValue: ( propertyId, kind, extra = {} ) => ( {
		type: ACTIONS.ADD_VALUE,
		propertyId,
		kind,
		...extra,
	} ),
	updateValue: ( valueId, patch ) => ( {
		type: ACTIONS.UPDATE_VALUE,
		valueId,
		patch,
	} ),
	removeValue: ( valueId ) => ( { type: ACTIONS.REMOVE_VALUE, valueId } ),
	moveValue: ( propertyId, from, to ) => ( {
		type: ACTIONS.MOVE_VALUE,
		propertyId,
		from,
		to,
	} ),
	nestNode: ( valueId, typeName, nodeId ) => ( {
		type: ACTIONS.NEST_NODE,
		valueId,
		typeName,
		nodeId,
	} ),
	clearNode: ( valueId ) => ( { type: ACTIONS.CLEAR_NODE, valueId } ),
};

function move( list, from, to ) {
	if (
		from === to ||
		from < 0 ||
		from >= list.length ||
		to < 0 ||
		to >= list.length
	) {
		return list;
	}
	const next = [ ...list ];
	const [ item ] = next.splice( from, 1 );
	next.splice( to, 0, item );
	return next;
}

function createNode( state, typeName, parentValueId, id, isRoot ) {
	const nodeId = id || makeId( 'n' );
	return {
		...state,
		nodes: {
			...state.nodes,
			[ nodeId ]: {
				id: nodeId,
				type: typeName,
				options: {
					...DEFAULT_NODE_OPTIONS,
					placement: isRoot ? 'graph' : 'inline',
					extraTypes: [],
				},
				propertyIds: [],
				parentValueId,
			},
		},
	};
}

function deleteSubtree( state, nodeId ) {
	const { nodes, properties, values } = collectSubtree( state, nodeId );
	const nextNodes = { ...state.nodes };
	const nextProps = { ...state.properties };
	const nextValues = { ...state.values };
	nodes.forEach( ( id ) => delete nextNodes[ id ] );
	properties.forEach( ( id ) => delete nextProps[ id ] );
	values.forEach( ( id ) => delete nextValues[ id ] );
	return {
		...state,
		nodes: nextNodes,
		properties: nextProps,
		values: nextValues,
	};
}

function createValue( state, propertyId, kind, extra ) {
	const valueId = extra.id || makeId( 'v' );
	const entry = { id: valueId, kind, propertyId };
	let next = state;
	if ( kind === 'text' ) {
		entry.value = extra.value || '';
		entry.allowPartial = Boolean( extra.allowPartial );
	} else if ( kind === 'ref' ) {
		entry.target = extra.target || '';
	} else if ( kind === 'node' || kind === 'repeat' ) {
		if ( kind === 'repeat' ) {
			entry.source = extra.source || '';
		}
		if ( extra.typeName ) {
			const nodeId = extra.nodeId || makeId( 'n' );
			next = createNode( next, extra.typeName, valueId, nodeId, false );
			entry.nodeId = nodeId;
		} else {
			entry.nodeId = null;
		}
	}
	const property = next.properties[ propertyId ];
	return {
		...next,
		values: { ...next.values, [ valueId ]: entry },
		properties: {
			...next.properties,
			[ propertyId ]: {
				...property,
				valueIds: [ ...property.valueIds, valueId ],
			},
		},
	};
}

/**
 * Pure reducer over the normalized template tree.
 *
 * @param {Object} [state] Normalized tables; defaults to an empty tree.
 * @param {Object} action  One of the `actions` creators' results.
 * @return {Object} The next state, or the same object when nothing changed.
 */
export function treeReducer( state = emptyState(), action ) {
	switch ( action.type ) {
		case ACTIONS.LOAD:
			return normalize( action.tree );

		case ACTIONS.SET_ROOT_TYPE: {
			if ( state.rootId && state.nodes[ state.rootId ] ) {
				return {
					...state,
					nodes: {
						...state.nodes,
						[ state.rootId ]: {
							...state.nodes[ state.rootId ],
							type: action.typeName,
						},
					},
				};
			}
			const next = createNode(
				state,
				action.typeName,
				null,
				action.id,
				true
			);
			const rootId =
				action.id ||
				Object.keys( next.nodes ).find( ( id ) => ! state.nodes[ id ] );
			return { ...next, rootId };
		}

		case ACTIONS.SET_NODE_TYPE: {
			const node = state.nodes[ action.nodeId ];
			if ( ! node ) {
				return state;
			}
			return {
				...state,
				nodes: {
					...state.nodes,
					[ action.nodeId ]: { ...node, type: action.typeName },
				},
			};
		}

		case ACTIONS.SET_NODE_OPTION: {
			const node = state.nodes[ action.nodeId ];
			if ( ! node ) {
				return state;
			}
			const options = { ...node.options, [ action.key ]: action.value };
			if ( action.nodeId === state.rootId ) {
				options.placement = 'graph';
			}
			return {
				...state,
				nodes: {
					...state.nodes,
					[ action.nodeId ]: { ...node, options },
				},
			};
		}

		case ACTIONS.ADD_PROPERTY: {
			const node = state.nodes[ action.nodeId ];
			if ( ! node ) {
				return state;
			}
			const propertyId = action.id || makeId( 'p' );
			let next = {
				...state,
				properties: {
					...state.properties,
					[ propertyId ]: {
						id: propertyId,
						name: action.name || '',
						dataType: action.dataType || DEFAULT_PROPERTY.dataType,
						onEmpty: action.onEmpty || DEFAULT_PROPERTY.onEmpty,
						fallback: action.fallback || '',
						valueIds: [],
						nodeId: action.nodeId,
					},
				},
			};
			const index =
				typeof action.index === 'number'
					? action.index
					: node.propertyIds.length;
			const propertyIds = [ ...node.propertyIds ];
			propertyIds.splice( index, 0, propertyId );
			next = {
				...next,
				nodes: {
					...next.nodes,
					[ action.nodeId ]: { ...node, propertyIds },
				},
			};
			if ( action.initialValue ) {
				next = createValue(
					next,
					propertyId,
					action.initialValue.kind || 'text',
					action.initialValue
				);
			}
			return next;
		}

		case ACTIONS.UPDATE_PROPERTY: {
			const property = state.properties[ action.propertyId ];
			if ( ! property ) {
				return state;
			}
			return {
				...state,
				properties: {
					...state.properties,
					[ action.propertyId ]: {
						...property,
						...action.patch,
						id: property.id,
						nodeId: property.nodeId,
						valueIds: property.valueIds,
					},
				},
			};
		}

		case ACTIONS.REMOVE_PROPERTY: {
			const property = state.properties[ action.propertyId ];
			if ( ! property ) {
				return state;
			}
			let next = state;
			for ( const vid of property.valueIds ) {
				const value = next.values[ vid ];
				if ( value && value.nodeId ) {
					next = deleteSubtree( next, value.nodeId );
				}
			}
			const values = { ...next.values };
			property.valueIds.forEach( ( vid ) => delete values[ vid ] );
			const properties = { ...next.properties };
			delete properties[ action.propertyId ];
			const node = next.nodes[ property.nodeId ];
			const nodes = node
				? {
						...next.nodes,
						[ property.nodeId ]: {
							...node,
							propertyIds: node.propertyIds.filter(
								( id ) => id !== action.propertyId
							),
						},
					}
				: next.nodes;
			return { ...next, values, properties, nodes };
		}

		case ACTIONS.MOVE_PROPERTY: {
			const node = state.nodes[ action.nodeId ];
			if ( ! node ) {
				return state;
			}
			const propertyIds = move(
				node.propertyIds,
				action.from,
				action.to
			);
			if ( propertyIds === node.propertyIds ) {
				return state;
			}
			return {
				...state,
				nodes: {
					...state.nodes,
					[ action.nodeId ]: { ...node, propertyIds },
				},
			};
		}

		case ACTIONS.ADD_VALUE: {
			if ( ! state.properties[ action.propertyId ] ) {
				return state;
			}
			return createValue(
				state,
				action.propertyId,
				action.kind || 'text',
				action
			);
		}

		case ACTIONS.UPDATE_VALUE: {
			const value = state.values[ action.valueId ];
			if ( ! value ) {
				return state;
			}
			return {
				...state,
				values: {
					...state.values,
					[ action.valueId ]: {
						...value,
						...action.patch,
						id: value.id,
						kind: value.kind,
						propertyId: value.propertyId,
					},
				},
			};
		}

		case ACTIONS.REMOVE_VALUE: {
			const value = state.values[ action.valueId ];
			if ( ! value ) {
				return state;
			}
			const next = value.nodeId
				? deleteSubtree( state, value.nodeId )
				: state;
			const values = { ...next.values };
			delete values[ action.valueId ];
			const property = next.properties[ value.propertyId ];
			const properties = property
				? {
						...next.properties,
						[ value.propertyId ]: {
							...property,
							valueIds: property.valueIds.filter(
								( id ) => id !== action.valueId
							),
						},
					}
				: next.properties;
			return { ...next, values, properties };
		}

		case ACTIONS.MOVE_VALUE: {
			const property = state.properties[ action.propertyId ];
			if ( ! property ) {
				return state;
			}
			const valueIds = move( property.valueIds, action.from, action.to );
			return valueIds === property.valueIds
				? state
				: {
						...state,
						properties: {
							...state.properties,
							[ action.propertyId ]: { ...property, valueIds },
						},
					};
		}

		case ACTIONS.NEST_NODE: {
			const value = state.values[ action.valueId ];
			if (
				! value ||
				( value.kind !== 'node' && value.kind !== 'repeat' )
			) {
				return state;
			}
			let next = value.nodeId
				? deleteSubtree( state, value.nodeId )
				: state;
			const nodeId = action.nodeId || makeId( 'n' );
			next = createNode(
				next,
				action.typeName,
				action.valueId,
				nodeId,
				false
			);
			return {
				...next,
				values: {
					...next.values,
					[ action.valueId ]: { ...value, nodeId },
				},
			};
		}

		case ACTIONS.CLEAR_NODE: {
			const value = state.values[ action.valueId ];
			if ( ! value || ! value.nodeId ) {
				return state;
			}
			const next = deleteSubtree( state, value.nodeId );
			return {
				...next,
				values: {
					...next.values,
					[ action.valueId ]: { ...value, nodeId: null },
				},
			};
		}

		default:
			return state;
	}
}
