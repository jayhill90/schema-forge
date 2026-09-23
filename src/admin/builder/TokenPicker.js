import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Button, Popover, SearchControl, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import api from '../api';

const cache = new Map();

/**
 * Query parameters for the token catalog endpoint.
 *
 * @param {Object|null} context Preview context: `{ postId }`, `{ kind, postType?, termId? }` or null.
 * @return {Object} Parameters for GET /schema-forge/v1/tokens.
 */
function catalogParams( context ) {
	if ( context && context.postId ) {
		return { post_id: context.postId };
	}
	if ( context && context.kind ) {
		return {
			kind: context.kind,
			post_type: context.postType,
			term_id: context.termId,
		};
	}
	return { post_type: context && context.postType };
}

export function useTokenCatalog( context ) {
	const key = JSON.stringify( context || {} );
	const [ state, setState ] = useState( () => ( {
		groups: cache.get( key ) || null,
		loading: ! cache.has( key ),
	} ) );

	useEffect( () => {
		let cancelled = false;
		if ( cache.has( key ) ) {
			setState( { groups: cache.get( key ), loading: false } );
			return undefined;
		}
		setState( { groups: null, loading: true } );
		api.tokens( catalogParams( JSON.parse( key ) ) )
			.then( ( groups ) => {
				cache.set( key, groups );
				if ( ! cancelled ) {
					setState( { groups, loading: false } );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setState( { groups: [], loading: false } );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [ key ] );

	return state;
}

/**
 * Button that opens a searchable token list and inserts the chosen token.
 *
 * @param {Object}                props
 * @param {Object|null}           props.context       Preview context used to load the token catalog.
 * @param {function(string):void} props.onInsert      Called with the token text, e.g. `{{post.title}}`.
 * @param {string}                [props.label]       Accessible label; defaults to "Insert dynamic value".
 * @param {string}                [props.size]        Button size.
 * @param {string}                [props.variant]     Button variant.
 * @param {string[]}              [props.filterTypes] Only show tokens of these types (e.g. `rows`, `list`).
 * @return {Element} The button and its popover.
 */
export default function TokenPicker( {
	context,
	onInsert,
	label,
	size = 'small',
	variant = 'secondary',
	filterTypes,
} ) {
	const [ open, setOpen ] = useState( false );
	const [ query, setQuery ] = useState( '' );
	const anchorRef = useRef( null );
	const { groups, loading } = useTokenCatalog( context );

	const filtered = useMemo( () => {
		if ( ! groups ) {
			return [];
		}
		const q = query.trim().toLowerCase();
		return groups
			.map( ( g ) => ( {
				...g,
				tokens: g.tokens.filter( ( t ) => {
					if ( filterTypes && ! filterTypes.includes( t.type ) ) {
						return false;
					}
					return (
						! q ||
						`${ t.token } ${ t.label } ${ t.description || '' }`
							.toLowerCase()
							.includes( q )
					);
				} ),
			} ) )
			.filter( ( g ) => g.tokens.length );
	}, [ groups, query, filterTypes ] );

	return (
		<>
			<Button
				ref={ anchorRef }
				size={ size }
				variant={ variant }
				icon="editor-code"
				aria-expanded={ open }
				aria-haspopup="dialog"
				onClick={ () => setOpen( ( o ) => ! o ) }
				label={ label || __( 'Insert dynamic value', 'schema-forge' ) }
				showTooltip
			>
				{ label ? undefined : __( 'Token', 'schema-forge' ) }
			</Button>
			{ open && (
				<Popover
					anchor={ anchorRef.current }
					onClose={ () => setOpen( false ) }
					onFocusOutside={ () => setOpen( false ) }
					placement="bottom-start"
					className="schema-forge-token-popover"
					focusOnMount="firstElement"
				>
					<div
						className="schema-forge-token-popover__inner"
						role="dialog"
						aria-label={ __( 'Dynamic values', 'schema-forge' ) }
					>
						<SearchControl
							value={ query }
							onChange={ setQuery }
							label={ __( 'Search tokens', 'schema-forge' ) }
							__nextHasNoMarginBottom
						/>
						{ loading && (
							<p role="status">
								<Spinner /> { __( 'Loading…', 'schema-forge' ) }
							</p>
						) }
						{ ! loading && ! filtered.length && (
							<p className="schema-forge-muted">
								{ __( 'No tokens match.', 'schema-forge' ) }
							</p>
						) }
						<div className="schema-forge-token-list">
							{ filtered.map( ( group ) => (
								<div
									key={ group.namespace }
									className="schema-forge-token-group"
								>
									<h4>{ group.label }</h4>
									<ul>
										{ group.tokens.map( ( t ) => (
											<li key={ t.token }>
												<button
													type="button"
													className="schema-forge-token-item"
													onClick={ () => {
														onInsert( t.token );
														setOpen( false );
													} }
													title={
														t.description || t.token
													}
												>
													<span className="schema-forge-token-item__label">
														{ t.label }
													</span>
													<code>{ t.token }</code>
													<span className="schema-forge-token-item__type">
														{ t.type }
													</span>
												</button>
											</li>
										) ) }
									</ul>
								</div>
							) ) }
						</div>
						<p className="schema-forge-token-help">
							{ __(
								'Filters: {{post.title|upper}}, {{terms.category|join:", "}}, {{post.date|date:Y-m-d}}, {{meta.key|default:"n/a"}}, {{meta.rating|nonzero}}, {{meta.status|map:"instock=https://schema.org/InStock"}}',
								'schema-forge'
							) }
						</p>
					</div>
				</Popover>
			) }
		</>
	);
}
