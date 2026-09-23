import { describe, expect, test } from 'vitest';
import fixture from './fixtures/mini-vocab.json';
import {
	compileVocab,
	allProperties,
	isSubtypeOf,
	cleanComment,
} from '../../scripts/lib/compile-vocab.mjs';

describe( 'compileVocab', () => {
	const { core, descriptions, meta } = compileVocab( fixture, {
		version: 'test',
	} );

	test( 'strips schema: prefix and records superclasses', () => {
		expect( core.types.Product.s ).toEqual( [ 'Thing' ] );
		expect( core.types.Vehicle.s ).toEqual( [ 'Product' ] );
		expect( core.types[ 'bibo:Issue' ] ).toBeUndefined();
	} );

	test( 'attaches direct properties to domain types only', () => {
		expect( core.types.Product.p ).toEqual( [
			'offers',
			'oldProp',
			'sku',
		] );
		expect( core.types.Thing.p ).toEqual( [ 'name', 'offers' ] );
		expect( core.types.Vehicle.p ).toEqual( [] );
	} );

	test( 'computes inherited properties on demand', () => {
		expect( allProperties( core, 'Vehicle' ) ).toEqual( [
			'name',
			'offers',
			'oldProp',
			'sku',
		] );
	} );

	test( 'records ranges and subPropertyOf', () => {
		expect( core.props.offers.r ).toEqual( [ 'Offer', 'Demand' ] );
		expect( core.props.sku.sub ).toEqual( [ 'identifier' ] );
	} );

	test( 'keeps superseded terms flagged, excludes attic terms, flags pending', () => {
		expect( core.props.oldProp.x ).toBe( 1 );
		expect( core.props.oldProp.sb ).toEqual( [ 'sku' ] );
		expect( core.types.Product.p ).toContain( 'oldProp' );
		expect(
			compileVocab( fixture, { includeSuperseded: false } ).core.props
				.oldProp
		).toBeUndefined();
		expect( core.types.AtticType ).toBeUndefined();
		expect( core.types.PendingType.pd ).toBe( 1 );
		expect( core.types.Product.pd ).toBe( 0 );
	} );

	test( 'detects enumerations and their members', () => {
		expect( core.types.DayOfWeek.e ).toBe( 1 );
		expect( core.types.Product.e ).toBe( 0 );
		expect( core.enums.DayOfWeek ).toEqual( [ 'Monday', 'Sunday' ] );
		expect( descriptions.enums.Monday ).toBe( 'Monday.' );
	} );

	test( 'detects data types including subclasses', () => {
		expect( core.datatypes ).toEqual( [ 'Text', 'URL' ] );
		expect( core.types.DataType ).toBeDefined();
	} );

	test( 'cleans descriptions', () => {
		expect( descriptions.types.Product ).toBe(
			'Any offered product or service. See Offer and link.'
		);
		expect( cleanComment( 'a'.repeat( 500 ) ).length ).toBeLessThanOrEqual(
			400
		);
	} );

	test( 'subtype checks walk the hierarchy', () => {
		expect( isSubtypeOf( core, 'Vehicle', 'Thing' ) ).toBe( true );
		expect( isSubtypeOf( core, 'Thing', 'Vehicle' ) ).toBe( false );
		expect( isSubtypeOf( core, 'URL', 'Text' ) ).toBe( true );
	} );

	test( 'adds extension properties such as query-input', () => {
		const withSearch = compileVocab(
			{
				'@graph': [
					...fixture[ '@graph' ],
					{
						'@id': 'schema:SearchAction',
						'@type': 'rdfs:Class',
						'rdfs:label': 'SearchAction',
						'rdfs:subClassOf': { '@id': 'schema:Thing' },
					},
				],
			},
			{ version: 'test' }
		);
		expect( withSearch.core.props[ 'query-input' ].ext ).toBe( 1 );
		expect( withSearch.core.types.SearchAction.p ).toContain(
			'query-input'
		);
		expect( withSearch.descriptions.props[ 'query-input' ] ).toMatch(
			/search box/i
		);
		expect( core.props[ 'query-input' ] ).toBeUndefined();
	} );

	test( 'meta counts', () => {
		expect( meta.version ).toBe( 'test' );
		expect( meta.counts.types ).toBe( Object.keys( core.types ).length );
	} );
} );
