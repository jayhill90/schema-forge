import { describe, expect, test } from 'vitest';
import { treeReducer, actions } from '../../src/shared/tree/reducer';
import { normalize, denormalize, emptyState } from '../../src/shared/tree/normalize';
import { nodeDepth, graphNodes, nodePath } from '../../src/shared/tree/selectors';

const sampleTree = {
	version: 1,
	root: {
		id: 'n_root',
		type: 'Product',
		options: { isMainEntity: true, idOverride: '', placement: 'graph', extraTypes: [] },
		properties: [
			{ id: 'p_name', name: 'name', dataType: 'auto', onEmpty: 'dropNode', fallback: '', values: [ { id: 'v_name', kind: 'text', value: '{{post.title}}', allowPartial: false } ] },
			{ id: 'p_offers', name: 'offers', dataType: 'auto', onEmpty: 'drop', fallback: '', values: [ { id: 'v_offer', kind: 'node', node: { id: 'n_offer', type: 'Offer', options: { isMainEntity: false, idOverride: '', placement: 'inline', extraTypes: [] }, properties: [ { id: 'p_price', name: 'price', dataType: 'number', onEmpty: 'drop', fallback: '', values: [ { id: 'v_price', kind: 'text', value: '{{meta.price}}', allowPartial: false } ] } ] } } ] },
			{ id: 'p_brand', name: 'brand', dataType: 'auto', onEmpty: 'drop', fallback: '', values: [ { id: 'v_brand', kind: 'ref', target: 'yoast:organization' } ] },
		],
	},
};

describe( 'normalize / denormalize', () => {
	test( 'round-trips a tree unchanged', () => {
		const state = normalize( sampleTree );
		expect( state.rootId ).toBe( 'n_root' );
		expect( Object.keys( state.nodes ) ).toHaveLength( 2 );
		expect( Object.keys( state.properties ) ).toHaveLength( 4 );
		const out = denormalize( state );
		expect( out ).toEqual( { ...sampleTree, root: { ...sampleTree.root, options: { ...sampleTree.root.options, collapsed: false }, properties: sampleTree.root.properties.map( ( p ) => p.name === 'offers' ? { ...p, values: [ { ...p.values[ 0 ], node: { ...p.values[ 0 ].node, options: { ...p.values[ 0 ].node.options, collapsed: false } } } ] } : p ) } } );
	} );

	test( 'handles an empty tree', () => {
		expect( normalize( { version: 1, root: null } ) ).toEqual( emptyState() );
		expect( denormalize( emptyState() ) ).toEqual( { version: 1, root: null } );
	} );
} );

describe( 'treeReducer', () => {
	const load = () => treeReducer( undefined, actions.load( sampleTree ) );

	test( 'sets a root type on an empty tree and forces graph placement', () => {
		const state = treeReducer( undefined, actions.setRootType( 'Event', 'n_x' ) );
		expect( state.rootId ).toBe( 'n_x' );
		expect( state.nodes.n_x.options.placement ).toBe( 'graph' );
		const changed = treeReducer( state, actions.setRootType( 'MusicEvent' ) );
		expect( changed.nodes.n_x.type ).toBe( 'MusicEvent' );
	} );

	test( 'adds, updates, moves and removes properties', () => {
		let state = load();
		state = treeReducer( state, actions.addProperty( 'n_root', 'sku', { id: 'p_sku', initialValue: { kind: 'text', value: '{{meta.sku}}', id: 'v_sku' } } ) );
		expect( state.nodes.n_root.propertyIds ).toEqual( [ 'p_name', 'p_offers', 'p_brand', 'p_sku' ] );
		expect( state.values.v_sku.value ).toBe( '{{meta.sku}}' );

		state = treeReducer( state, actions.updateProperty( 'p_sku', { onEmpty: 'fallback', fallback: 'N/A', nodeId: 'hack' } ) );
		expect( state.properties.p_sku.onEmpty ).toBe( 'fallback' );
		expect( state.properties.p_sku.nodeId ).toBe( 'n_root' );

		state = treeReducer( state, actions.moveProperty( 'n_root', 3, 0 ) );
		expect( state.nodes.n_root.propertyIds[ 0 ] ).toBe( 'p_sku' );

		state = treeReducer( state, actions.removeProperty( 'p_offers' ) );
		expect( state.properties.p_offers ).toBeUndefined();
		expect( state.nodes.n_offer ).toBeUndefined();
		expect( state.values.v_price ).toBeUndefined();
		expect( state.nodes.n_root.propertyIds ).toEqual( [ 'p_sku', 'p_name', 'p_brand' ] );
	} );

	test( 'nests and clears nodes on values', () => {
		let state = load();
		state = treeReducer( state, actions.addValue( 'p_brand', 'node', { id: 'v_b2', typeName: 'Brand', nodeId: 'n_b2' } ) );
		expect( state.values.v_b2.nodeId ).toBe( 'n_b2' );
		expect( state.nodes.n_b2.parentValueId ).toBe( 'v_b2' );
		expect( nodeDepth( state, 'n_b2' ) ).toBe( 1 );
		expect( nodePath( state, 'n_b2' ) ).toEqual( [ 'Product', 'brand', 'Brand' ] );

		state = treeReducer( state, actions.nestNode( 'v_b2', 'Organization', 'n_b3' ) );
		expect( state.nodes.n_b2 ).toBeUndefined();
		expect( state.values.v_b2.nodeId ).toBe( 'n_b3' );

		state = treeReducer( state, actions.clearNode( 'v_b2' ) );
		expect( state.values.v_b2.nodeId ).toBeNull();
		expect( state.nodes.n_b3 ).toBeUndefined();

		state = treeReducer( state, actions.removeValue( 'v_b2' ) );
		expect( state.properties.p_brand.valueIds ).toEqual( [ 'v_brand' ] );
	} );

	test( 'graph-placed nodes are listed for node: refs', () => {
		let state = load();
		state = treeReducer( state, actions.setNodeOption( 'n_offer', 'placement', 'graph' ) );
		expect( graphNodes( state ).map( ( n ) => n.id ).sort() ).toEqual( [ 'n_offer', 'n_root' ] );
		state = treeReducer( state, actions.setNodeOption( 'n_root', 'placement', 'inline' ) );
		expect( state.nodes.n_root.options.placement ).toBe( 'graph' );
	} );

	test( 'ignores actions on unknown ids', () => {
		const state = load();
		expect( treeReducer( state, actions.removeProperty( 'nope' ) ) ).toBe( state );
		expect( treeReducer( state, actions.updateValue( 'nope', {} ) ) ).toBe( state );
		expect( treeReducer( state, actions.moveProperty( 'n_root', 0, 9 ) ) ).toBe( state );
	} );
} );
