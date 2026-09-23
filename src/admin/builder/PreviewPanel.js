import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import {
	Button,
	ComboboxControl,
	Notice,
	SelectControl,
	Spinner,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import api, { errorMessage } from '../api';
import { config } from '../config';
import { useDebounce } from '../hooks/useDebounce';
import { useBuilder } from './BuilderContext';
import { denormalize } from '../../shared/tree/normalize';

const ARCHIVE_KINDS = [
	{
		value: 'front_page',
		label: __( 'Front page (latest posts)', 'schema-forge' ),
	},
	{ value: 'blog', label: __( 'Blog index', 'schema-forge' ) },
	{
		value: 'post_type_archive',
		label: __( 'Post type archive', 'schema-forge' ),
	},
	{ value: 'term_archive', label: __( 'Term archive', 'schema-forge' ) },
	{ value: 'search', label: __( 'Search results', 'schema-forge' ) },
	{ value: 'not_found', label: __( '404 page', 'schema-forge' ) },
	{ value: 'author', label: __( 'Author archive', 'schema-forge' ) },
	{ value: 'date', label: __( 'Date archive', 'schema-forge' ) },
];

export function usePostSearch( subtype = 'any' ) {
	const [ query, setQuery ] = useState( '' );
	const [ options, setOptions ] = useState( [] );
	const debounced = useDebounce( query, 250 );
	useEffect( () => {
		let cancelled = false;
		api.searchPosts( debounced, subtype )
			.then( ( results ) => {
				if ( ! cancelled ) {
					setOptions(
						results.map( ( r ) => ( {
							value: String( r.id ),
							label: `${ r.title } (${ r.subtype })`,
						} ) )
					);
				}
			} )
			.catch( () => {} );
		return () => {
			cancelled = true;
		};
	}, [ debounced, subtype ] );
	return { options, setQuery };
}

export function useTermSearch( restBase ) {
	const [ query, setQuery ] = useState( '' );
	const [ options, setOptions ] = useState( [] );
	const debounced = useDebounce( query, 250 );
	useEffect( () => {
		if ( ! restBase ) {
			setOptions( [] );
			return undefined;
		}
		let cancelled = false;
		api.searchTerms( restBase, debounced )
			.then( ( results ) => {
				if ( ! cancelled ) {
					setOptions(
						results.map( ( t ) => ( {
							value: String( t.id ),
							label: t.name,
						} ) )
					);
				}
			} )
			.catch( () => {} );
		return () => {
			cancelled = true;
		};
	}, [ debounced, restBase ] );
	return { options, setQuery };
}

/**
 * Preview context chooser: a post, or an archive kind.
 *
 * @param {Object}                     props
 * @param {Object|null}                props.value    Current context (`{ postId }` or `{ kind, postType?, termId? }`).
 * @param {function(Object|null):void} props.onChange Called with the new context, or null when cleared.
 * @return {Element} The picker controls.
 */
export function ContextPicker( { value, onChange } ) {
	const [ mode, setMode ] = useState(
		value && value.kind ? 'archive' : 'post'
	);
	const { options: postOptions, setQuery: setPostQuery } = usePostSearch();
	const taxonomies = config.taxonomies;
	const [ taxonomy, setTaxonomy ] = useState(
		taxonomies[ 0 ] ? taxonomies[ 0 ].name : ''
	);
	const tax = taxonomies.find( ( t ) => t.name === taxonomy );
	const { options: termOptions, setQuery: setTermQuery } = useTermSearch(
		tax ? tax.restBase : ''
	);

	const postId = value && value.postId ? String( value.postId ) : '';
	const merged = useMemo( () => {
		if ( postId && ! postOptions.find( ( o ) => o.value === postId ) ) {
			return [
				{ value: postId, label: value.title || `#${ postId }` },
				...postOptions,
			];
		}
		return postOptions;
	}, [ postOptions, postId, value ] );

	return (
		<div className="schema-forge-preview__context">
			<SelectControl
				label={ __( 'Preview against', 'schema-forge' ) }
				value={ mode }
				options={ [
					{
						value: 'post',
						label: __( 'A post or page', 'schema-forge' ),
					},
					{
						value: 'archive',
						label: __(
							'An archive / special page',
							'schema-forge'
						),
					},
				] }
				onChange={ ( m ) => {
					setMode( m );
					onChange( null );
				} }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			{ mode === 'post' && (
				<ComboboxControl
					label={ __( 'Post', 'schema-forge' ) }
					value={ postId }
					options={ merged }
					onFilterValueChange={ setPostQuery }
					onChange={ ( v ) =>
						onChange(
							v
								? {
										postId: Number( v ),
										title: (
											merged.find(
												( o ) => o.value === v
											) || {}
										).label,
									}
								: null
						)
					}
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
			) }
			{ mode === 'archive' && (
				<>
					<SelectControl
						label={ __( 'Page kind', 'schema-forge' ) }
						value={ ( value && value.kind ) || '' }
						options={ [
							{
								value: '',
								label: __( 'Choose…', 'schema-forge' ),
							},
							...ARCHIVE_KINDS,
						] }
						onChange={ ( kind ) =>
							onChange( kind ? { kind } : null )
						}
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
					{ value && value.kind === 'post_type_archive' && (
						<SelectControl
							label={ __( 'Post type', 'schema-forge' ) }
							value={ value.postType || '' }
							options={ [
								{
									value: '',
									label: __( 'Choose…', 'schema-forge' ),
								},
								...config.postTypes
									.filter( ( p ) => p.hasArchive )
									.map( ( p ) => ( {
										value: p.name,
										label: p.label,
									} ) ),
							] }
							onChange={ ( postType ) =>
								onChange( { ...value, postType } )
							}
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
					) }
					{ value && value.kind === 'term_archive' && (
						<>
							<SelectControl
								label={ __( 'Taxonomy', 'schema-forge' ) }
								value={ taxonomy }
								options={ taxonomies.map( ( t ) => ( {
									value: t.name,
									label: t.label,
								} ) ) }
								onChange={ ( t ) => {
									setTaxonomy( t );
									onChange( { kind: 'term_archive' } );
								} }
								__nextHasNoMarginBottom
								__next40pxDefaultSize
							/>
							<ComboboxControl
								label={ __( 'Term', 'schema-forge' ) }
								value={
									value.termId ? String( value.termId ) : ''
								}
								options={ termOptions }
								onFilterValueChange={ setTermQuery }
								onChange={ ( v ) =>
									onChange( {
										...value,
										termId: v ? Number( v ) : 0,
									} )
								}
								__nextHasNoMarginBottom
								__next40pxDefaultSize
							/>
						</>
					) }
				</>
			) }
		</div>
	);
}

function contextReady( ctx ) {
	if ( ! ctx ) {
		return false;
	}
	if ( ctx.postId ) {
		return true;
	}
	if ( ctx.kind === 'post_type_archive' ) {
		return Boolean( ctx.postType );
	}
	if ( ctx.kind === 'term_archive' ) {
		return Boolean( ctx.termId );
	}
	return Boolean( ctx.kind );
}

export default function PreviewPanel( {
	previewContext,
	setPreviewContext,
	onTokens,
} ) {
	const { state } = useBuilder();
	const [ result, setResult ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ loading, setLoading ] = useState( false );
	const [ copied, setCopied ] = useState( false );
	const requestId = useRef( 0 );

	const treeJson = useMemo(
		() => JSON.stringify( denormalize( state.tree ) ),
		[ state.tree ]
	);
	const settingsJson = JSON.stringify( state.settings );
	const debouncedTree = useDebounce( treeJson, 500 );
	const ready = contextReady( previewContext );

	useEffect( () => {
		if ( ! ready || ! state.tree.rootId ) {
			setResult( null );
			return;
		}
		const id = ++requestId.current;
		setLoading( true );
		setError( null );
		api.preview( {
			id: state.loadedId || 0,
			tree: JSON.parse( debouncedTree ),
			settings: JSON.parse( settingsJson ),
			context: previewContext,
		} )
			.then( ( res ) => {
				if ( id !== requestId.current ) {
					return;
				}
				setResult( res );
				onTokens( res.tokens || {} );
			} )
			.catch( ( e ) => {
				if ( id === requestId.current ) {
					setError(
						errorMessage(
							e,
							__( 'Preview failed.', 'schema-forge' )
						)
					);
				}
			} )
			.finally( () => {
				if ( id === requestId.current ) {
					setLoading( false );
				}
			} );
	}, [
		debouncedTree,
		settingsJson,
		previewContext,
		ready,
		state.tree.rootId,
		state.loadedId,
		onTokens,
	] );

	const json = result
		? JSON.stringify( result.fullGraph || result.graph, null, 2 )
		: '';

	const copy = () => {
		if ( navigator.clipboard && json ) {
			navigator.clipboard.writeText( json ).then( () => {
				setCopied( true );
				setTimeout( () => setCopied( false ), 2000 );
			} );
		}
	};

	return (
		<div className="schema-forge-preview">
			<ContextPicker
				value={ previewContext }
				onChange={ setPreviewContext }
			/>
			{ ! ready && (
				<p className="schema-forge-muted">
					{ __(
						'Pick a post or page to see the compiled JSON-LD with real values.',
						'schema-forge'
					) }
				</p>
			) }
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			{ result && result.warnings && result.warnings.length > 0 && (
				<Notice status="warning" isDismissible={ false }>
					<ul>
						{ result.warnings.map( ( w, i ) => (
							<li key={ i }>{ w }</li>
						) ) }
					</ul>
				</Notice>
			) }
			{ result && result.context && (
				<p className="schema-forge-preview__meta">
					{ sprintf(
						/* translators: %s url */ __(
							'Compiled for %s',
							'schema-forge'
						),
						result.context.canonical
					) }
					{ result.context.yoast
						? ` · ${ __( 'Yoast context', 'schema-forge' ) }`
						: '' }
					{ result.graph &&
					result.graph[ '@graph' ] &&
					result.graph[ '@graph' ].length === 0
						? ` · ${ __( 'No nodes produced (required values empty?)', 'schema-forge' ) }`
						: '' }
				</p>
			) }
			<div className="schema-forge-preview__toolbar">
				{ loading && (
					<span role="status">
						<Spinner /> { __( 'Compiling…', 'schema-forge' ) }
					</span>
				) }
				{ json && (
					<Button size="small" variant="secondary" onClick={ copy }>
						{ copied
							? __( 'Copied!', 'schema-forge' )
							: __( 'Copy JSON', 'schema-forge' ) }
					</Button>
				) }
				{ json && result.context && result.context.postId ? (
					<Button
						size="small"
						variant="tertiary"
						href={ `https://search.google.com/test/rich-results?url=${ encodeURIComponent( result.context.canonical ) }` }
						target="_blank"
						rel="noreferrer"
					>
						{ __( 'Rich Results Test ↗', 'schema-forge' ) }
					</Button>
				) : null }
			</div>
			{ json && (
				<pre
					className="schema-forge-preview__json"
					tabIndex={ 0 }
					aria-label={ __( 'Compiled JSON-LD', 'schema-forge' ) }
				>
					{ json }
				</pre>
			) }
		</div>
	);
}
