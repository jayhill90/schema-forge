import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useReducer,
} from '@wordpress/element';
import { treeReducer, actions as treeActions } from '../../shared/tree/reducer';
import { emptyState, normalize } from '../../shared/tree/normalize';

const HISTORY_LIMIT = 100;

const initial = {
	tree: emptyState(),
	past: [],
	future: [],
	selection: null, // { kind: 'node'|'property'|'value', id }
	meta: { name: '', description: '', enabled: false },
	settings: {
		yoast: { suppressArticle: false, webPageType: '' },
		standalone: { includeCoreNodes: true },
	},
	dirty: false,
	loadedId: null,
};

function rootReducer( state, action ) {
	switch ( action.type ) {
		case 'INIT': {
			return {
				...initial,
				tree: normalize( action.template.tree ),
				meta: {
					name: action.template.name || '',
					description: action.template.description || '',
					enabled: Boolean( action.template.enabled ),
				},
				settings: {
					...initial.settings,
					...( action.template.settings || {} ),
				},
				loadedId: action.template.id || null,
				dirty: false,
			};
		}
		case 'SET_META':
			return {
				...state,
				meta: { ...state.meta, ...action.patch },
				dirty: true,
			};
		case 'SET_SETTING': {
			const settings = {
				...state.settings,
				[ action.group ]: {
					...state.settings[ action.group ],
					[ action.key ]: action.value,
				},
			};
			return { ...state, settings, dirty: true };
		}
		case 'SELECT':
			return { ...state, selection: action.selection };
		case 'MARK_SAVED':
			return {
				...state,
				dirty: false,
				loadedId: action.id ?? state.loadedId,
			};
		case 'UNDO': {
			if ( ! state.past.length ) {
				return state;
			}
			const previous = state.past[ state.past.length - 1 ];
			return {
				...state,
				tree: previous,
				past: state.past.slice( 0, -1 ),
				future: [ state.tree, ...state.future ],
				dirty: true,
			};
		}
		case 'REDO': {
			if ( ! state.future.length ) {
				return state;
			}
			const [ next, ...rest ] = state.future;
			return {
				...state,
				tree: next,
				past: [ ...state.past, state.tree ],
				future: rest,
				dirty: true,
			};
		}
		case 'TREE': {
			const tree = treeReducer( state.tree, action.action );
			if ( tree === state.tree ) {
				return state;
			}
			const past = [ ...state.past, state.tree ].slice( -HISTORY_LIMIT );
			let selection = state.selection;
			if ( selection && ! lookup( tree, selection ) ) {
				selection = null;
			}
			return { ...state, tree, past, future: [], dirty: true, selection };
		}
		default:
			return state;
	}
}

function lookup( tree, selection ) {
	if ( ! selection ) {
		return null;
	}
	const table = {
		node: tree.nodes,
		property: tree.properties,
		value: tree.values,
	}[ selection.kind ];
	return table ? table[ selection.id ] : null;
}

const BuilderContext = createContext( null );

export function BuilderProvider( { children } ) {
	const [ state, dispatch ] = useReducer( rootReducer, initial );

	const api = useMemo( () => {
		const tree = ( action ) => dispatch( { type: 'TREE', action } );
		return {
			init: ( template ) => dispatch( { type: 'INIT', template } ),
			setMeta: ( patch ) => dispatch( { type: 'SET_META', patch } ),
			setSetting: ( group, key, value ) =>
				dispatch( { type: 'SET_SETTING', group, key, value } ),
			select: ( selection ) => dispatch( { type: 'SELECT', selection } ),
			markSaved: ( id ) => dispatch( { type: 'MARK_SAVED', id } ),
			undo: () => dispatch( { type: 'UNDO' } ),
			redo: () => dispatch( { type: 'REDO' } ),
			tree,
			// Convenience wrappers around tree actions.
			setRootType: ( t, id ) => tree( treeActions.setRootType( t, id ) ),
			setNodeType: ( nodeId, t ) =>
				tree( treeActions.setNodeType( nodeId, t ) ),
			setNodeOption: ( nodeId, key, value ) =>
				tree( treeActions.setNodeOption( nodeId, key, value ) ),
			addProperty: ( nodeId, name, extra ) =>
				tree( treeActions.addProperty( nodeId, name, extra ) ),
			updateProperty: ( id, patch ) =>
				tree( treeActions.updateProperty( id, patch ) ),
			removeProperty: ( id ) => tree( treeActions.removeProperty( id ) ),
			moveProperty: ( nodeId, from, to ) =>
				tree( treeActions.moveProperty( nodeId, from, to ) ),
			addValue: ( propertyId, kind, extra ) =>
				tree( treeActions.addValue( propertyId, kind, extra ) ),
			updateValue: ( id, patch ) =>
				tree( treeActions.updateValue( id, patch ) ),
			removeValue: ( id ) => tree( treeActions.removeValue( id ) ),
			moveValue: ( propertyId, from, to ) =>
				tree( treeActions.moveValue( propertyId, from, to ) ),
			nestNode: ( valueId, t, nodeId ) =>
				tree( treeActions.nestNode( valueId, t, nodeId ) ),
			clearNode: ( valueId ) => tree( treeActions.clearNode( valueId ) ),
		};
	}, [] );

	const value = useMemo(
		() => ( {
			state,
			...api,
			canUndo: state.past.length > 0,
			canRedo: state.future.length > 0,
		} ),
		[ state, api ]
	);

	return (
		<BuilderContext.Provider value={ value }>
			{ children }
		</BuilderContext.Provider>
	);
}

export function useBuilder() {
	const ctx = useContext( BuilderContext );
	if ( ! ctx ) {
		throw new Error( 'useBuilder must be used inside BuilderProvider' );
	}
	return ctx;
}

/**
 * Resolved token values from the last preview, keyed by token text.
 */
export const PreviewTokensContext = createContext( {} );

export function usePreviewTokens() {
	return useContext( PreviewTokensContext );
}

export function useSelection( kind, id ) {
	const { state, select } = useBuilder();
	const isSelected = Boolean(
		state.selection &&
		state.selection.kind === kind &&
		state.selection.id === id
	);
	const doSelect = useCallback(
		() => select( { kind, id } ),
		[ select, kind, id ]
	);
	return [ isSelected, doSelect ];
}
