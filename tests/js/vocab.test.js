import fixture from './fixtures/mini-vocab.json';
import { compileVocab } from '../../scripts/lib/compile-vocab.mjs';
import { getAllProperties, isSubtypeOf, typeFitsProperty, searchTypes, suggestDataType, getGroup, getNodeRange, isPropertySuperseded, supersededBy } from '../../src/shared/vocab';

const { core } = compileVocab( fixture, { version: 'test' } );

describe( 'vocab helpers', () => {
	test( 'inherited properties are flagged by origin', () => {
		expect( getAllProperties( core, 'Vehicle' ) ).toEqual( [
			{ name: 'name', own: false, from: 'Thing', deprecated: false, replacedBy: [], extension: false },
			{ name: 'offers', own: false, from: 'Product', deprecated: false, replacedBy: [], extension: false },
			{ name: 'sku', own: false, from: 'Product', deprecated: false, replacedBy: [], extension: false },
			{ name: 'oldProp', own: false, from: 'Product', deprecated: true, replacedBy: [ 'sku' ], extension: false },
		] );
		expect( isPropertySuperseded( core, 'oldProp' ) ).toBe( true );
		expect( supersededBy( core, 'oldProp' ) ).toEqual( [ 'sku' ] );
	} );

	test( 'subtype and range checks', () => {
		expect( isSubtypeOf( core, 'Vehicle', 'Thing' ) ).toBe( true );
		expect( typeFitsProperty( core, 'offers', 'Offer' ) ).toBe( true );
		expect( typeFitsProperty( core, 'offers', 'Vehicle' ) ).toBe( false );
		expect( typeFitsProperty( core, 'unknownProp', 'Vehicle' ) ).toBe( true );
		expect( getNodeRange( core, 'name' ) ).toEqual( [] );
	} );

	test( 'search ranks prefix matches first and hides data types', () => {
		expect( searchTypes( core, 'pro' ) ).toEqual( [ 'Product' ] );
		expect( searchTypes( core, 'thing' ) ).toEqual( [ 'Thing', 'Product', 'Vehicle', 'DayOfWeek', 'Enumeration', 'PendingType' ] );
		expect( searchTypes( core, '' ) ).not.toContain( 'Text' );
	} );

	test( 'data type suggestions and grouping', () => {
		expect( suggestDataType( core, 'sku' ) ).toBe( 'auto' );
		expect( suggestDataType( core, 'nope' ) ).toBe( 'auto' );
		expect( getGroup( core, 'Vehicle' ) ).toBe( 'Product' );
		expect( getGroup( core, 'Product' ) ).toBe( 'Product' );
	} );
} );
