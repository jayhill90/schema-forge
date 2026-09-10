import { parseTokens, isSingleToken, segmentText, hasTokens } from '../../src/shared/tokens/parse';

describe( 'parseTokens', () => {
	test( 'parses namespace and path', () => {
		expect( parseTokens( '{{post.title}}' ) ).toEqual( [
			{ match: '{{post.title}}', namespace: 'post', path: 'title', filters: [], index: 0 },
		] );
	} );

	test( 'parses dotted paths, whitespace and mixed case namespace', () => {
		const [ t ] = parseTokens( 'Hello {{ Post.author.name }}!' );
		expect( t.namespace ).toBe( 'post' );
		expect( t.path ).toBe( 'author.name' );
		expect( t.index ).toBe( 6 );
	} );

	test( 'parses filters with quoted args', () => {
		const [ t ] = parseTokens( '{{terms.category|join:", "|upper}}' );
		expect( t.filters ).toEqual( [
			{ name: 'join', arg: ', ' },
			{ name: 'upper', arg: null },
		] );
	} );

	test( 'finds multiple tokens', () => {
		expect( parseTokens( '{{post.title}} – {{site.name}}' ).map( ( t ) => t.path ) ).toEqual( [ 'title', 'name' ] );
	} );

	test( 'ignores malformed tokens', () => {
		expect( parseTokens( '{{title}} {{post.}} {{1post.title}}' ) ).toEqual( [] );
		expect( hasTokens( 'plain' ) ).toBe( false );
	} );

	test( 'single token detection', () => {
		expect( isSingleToken( ' {{meta.price}} ' ) ).toBe( true );
		expect( isSingleToken( '{{meta.price}} USD' ) ).toBe( false );
	} );

	test( 'segments text for highlighting', () => {
		expect( segmentText( 'A {{post.title}} B' ).map( ( s ) => s.type ) ).toEqual( [ 'text', 'token', 'text' ] );
		expect( segmentText( '' ) ).toEqual( [] );
	} );
} );
