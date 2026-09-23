import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import {
	Button,
	ComboboxControl,
	Flex,
	FlexItem,
	FormTokenField,
	Notice,
	Panel,
	PanelBody,
	SelectControl,
	Spinner,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import api, { errorMessage } from '../../api';
import { config } from '../../config';
import { useNotices } from '../../components/Notices';
import { useTermSearch } from '../../builder/PreviewPanel';

const EMPTY_RULES = {
	version: 1,
	post_types: {},
	taxonomies: {},
	archives: {
		front_page: [],
		blog: [],
		search: [],
		not_found: [],
		author: [],
		date: [],
		post_type: {},
		taxonomy: {},
	},
};

/**
 * Multi-select of templates rendered as a token field (accessible, keyboard friendly).
 *
 * @param {Object}                         props
 * @param {string}                         props.label     Field label.
 * @param {number[]}                       props.value     Selected template ids.
 * @param {function(number[]):void}        props.onChange  Called with the new list of template ids.
 * @param {Array<{id:number,name:string}>} props.templates All selectable templates.
 * @param {string}                         [props.help]    Help text.
 * @return {Element} The token field.
 */
function TemplateSelect( { label, value, onChange, templates, help } ) {
	const byName = useMemo(
		() => new Map( templates.map( ( t ) => [ t.name, t.id ] ) ),
		[ templates ]
	);
	const byId = useMemo(
		() => new Map( templates.map( ( t ) => [ t.id, t.name ] ) ),
		[ templates ]
	);
	const tokens = ( value || [] )
		.map( ( id ) => byId.get( id ) )
		.filter( Boolean );
	return (
		<FormTokenField
			label={ label }
			value={ tokens }
			suggestions={ templates.map( ( t ) => t.name ) }
			onChange={ ( next ) =>
				onChange(
					next
						.map( ( n ) =>
							byName.get( typeof n === 'string' ? n : n.value )
						)
						.filter( Boolean )
				)
			}
			__experimentalExpandOnFocus
			__experimentalShowHowTo={ false }
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			placeholder={ __( 'Type to add a template…', 'schema-forge' ) }
			help={ help }
		/>
	);
}

function TermRules( { taxonomy, conf, templates, onChange } ) {
	const { options, setQuery } = useTermSearch( taxonomy.restBase );
	const [ names, setNames ] = useState( {} );
	// Ids whose names were already requested, so a deleted term is fetched once rather than in a loop.
	const requested = useRef( new Set() );
	const termIds = Object.keys( conf.terms || {} ).map( Number );
	const termKey = termIds.join( ',' );

	useEffect( () => {
		const missing = termKey
			.split( ',' )
			.filter( Boolean )
			.map( Number )
			.filter( ( id ) => ! requested.current.has( id ) );
		if ( ! missing.length ) {
			return;
		}
		missing.forEach( ( id ) => requested.current.add( id ) );
		api.getTerms( taxonomy.restBase, missing )
			.then( ( terms ) => {
				setNames( ( n ) => ( {
					...n,
					...Object.fromEntries(
						terms.map( ( t ) => [ t.id, t.name ] )
					),
				} ) );
			} )
			.catch( () => {} );
	}, [ termKey, taxonomy.restBase ] );

	const addTerm = ( id ) => {
		if ( ! id || conf.terms[ id ] ) {
			return;
		}
		const opt = options.find( ( o ) => o.value === String( id ) );
		if ( opt ) {
			setNames( ( n ) => ( { ...n, [ id ]: opt.label } ) );
		}
		onChange( {
			...conf,
			terms: { ...conf.terms, [ id ]: { add: [], exclude: [] } },
		} );
	};

	return (
		<div className="schema-forge-rules__terms">
			<ComboboxControl
				label={ sprintf(
					/* translators: %s taxonomy */ __(
						'Add a rule for a specific %s term',
						'schema-forge'
					),
					taxonomy.label.toLowerCase()
				) }
				value=""
				options={ options.filter( ( o ) => ! conf.terms[ o.value ] ) }
				onFilterValueChange={ setQuery }
				onChange={ ( v ) => addTerm( Number( v ) ) }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			{ termIds.map( ( id ) => (
				<div key={ id } className="schema-forge-rules__term">
					<Flex justify="space-between" align="center">
						<FlexItem>
							<strong>{ names[ id ] || `#${ id }` }</strong>
						</FlexItem>
						<FlexItem>
							<Button
								size="small"
								variant="tertiary"
								isDestructive
								onClick={ () => {
									const terms = { ...conf.terms };
									delete terms[ id ];
									onChange( { ...conf, terms } );
								} }
							>
								{ __( 'Remove rule', 'schema-forge' ) }
							</Button>
						</FlexItem>
					</Flex>
					<TemplateSelect
						label={ __( 'Add templates', 'schema-forge' ) }
						value={ conf.terms[ id ].add }
						templates={ templates }
						onChange={ ( add ) =>
							onChange( {
								...conf,
								terms: {
									...conf.terms,
									[ id ]: { ...conf.terms[ id ], add },
								},
							} )
						}
					/>
					<TemplateSelect
						label={ __( 'Exclude templates', 'schema-forge' ) }
						value={ conf.terms[ id ].exclude }
						templates={ templates }
						onChange={ ( exclude ) =>
							onChange( {
								...conf,
								terms: {
									...conf.terms,
									[ id ]: { ...conf.terms[ id ], exclude },
								},
							} )
						}
						help={ __(
							'Removes templates inherited from the post type or taxonomy.',
							'schema-forge'
						) }
					/>
				</div>
			) ) }
		</div>
	);
}

export default function Rules() {
	const { notify } = useNotices();
	const [ rules, setRules ] = useState( null );
	const [ templates, setTemplates ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ dirty, setDirty ] = useState( false );

	useEffect( () => {
		Promise.all( [ api.getRules(), api.listTemplates() ] )
			.then( ( [ r, t ] ) => {
				setRules( {
					...EMPTY_RULES,
					...r,
					archives: {
						...EMPTY_RULES.archives,
						...( r.archives || {} ),
					},
				} );
				setTemplates(
					t
						.filter( ( x ) => x.enabled )
						.concat(
							t
								.filter( ( x ) => ! x.enabled )
								.map( ( x ) => ( {
									...x,
									name: `${ x.name } (${ __( 'disabled', 'schema-forge' ) })`,
								} ) )
						)
				);
			} )
			.catch( ( e ) =>
				setError(
					errorMessage(
						e,
						__( 'Could not load rules.', 'schema-forge' )
					)
				)
			);
	}, [] );

	const update = useCallback( ( updater ) => {
		setRules( ( r ) => updater( r ) );
		setDirty( true );
	}, [] );

	useEffect( () => {
		if ( ! dirty ) {
			return undefined;
		}
		const handler = ( e ) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener( 'beforeunload', handler );
		return () => window.removeEventListener( 'beforeunload', handler );
	}, [ dirty ] );

	const save = async () => {
		setSaving( true );
		try {
			const saved = await api.saveRules( rules );
			setRules( saved );
			setDirty( false );
			notify( __( 'Rules saved.', 'schema-forge' ) );
		} catch ( e ) {
			notify(
				errorMessage(
					e,
					__( 'Could not save rules.', 'schema-forge' )
				),
				{ status: 'error' }
			);
		} finally {
			setSaving( false );
		}
	};

	if ( error ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ error }
			</Notice>
		);
	}
	if ( ! rules || ! templates ) {
		return (
			<p role="status">
				<Spinner /> { __( 'Loading rules…', 'schema-forge' ) }
			</p>
		);
	}

	const archiveLabels = {
		front_page:
			config.showOnFront === 'page'
				? __( 'Front page (static page)', 'schema-forge' )
				: __( 'Front page (latest posts)', 'schema-forge' ),
		blog: __( 'Blog index', 'schema-forge' ),
		search: __( 'Search results', 'schema-forge' ),
		not_found: __( '404 page', 'schema-forge' ),
		author: __( 'Author archives', 'schema-forge' ),
		date: __( 'Date archives', 'schema-forge' ),
	};

	return (
		<div className="schema-forge-screen schema-forge-rules">
			<Flex
				justify="space-between"
				align="center"
				className="schema-forge-screen__toolbar"
			>
				<FlexItem>
					<h2>{ __( 'Assignment rules', 'schema-forge' ) }</h2>
					<p className="description">
						{ __(
							'Templates apply in this order: post type defaults → taxonomy → term (add/exclude) → per-post overrides. Each template renders once per page.',
							'schema-forge'
						) }
					</p>
				</FlexItem>
				<FlexItem>
					<Button
						variant="primary"
						onClick={ save }
						isBusy={ saving }
						disabled={ saving || ! dirty }
					>
						{ __( 'Save rules', 'schema-forge' ) }
					</Button>
				</FlexItem>
			</Flex>

			<Panel header={ __( 'Post types', 'schema-forge' ) }>
				<PanelBody>
					<p className="description">
						{ __(
							'Default templates for every post of a type.',
							'schema-forge'
						) }
					</p>
					{ config.postTypes.map( ( pt ) => (
						<TemplateSelect
							key={ pt.name }
							label={ pt.label }
							value={ rules.post_types[ pt.name ] || [] }
							templates={ templates }
							onChange={ ( ids ) =>
								update( ( r ) => ( {
									...r,
									post_types: {
										...r.post_types,
										[ pt.name ]: ids,
									},
								} ) )
							}
						/>
					) ) }
				</PanelBody>
			</Panel>

			<Panel header={ __( 'Taxonomies and terms', 'schema-forge' ) }>
				{ config.taxonomies.map( ( tax ) => {
					const conf = rules.taxonomies[ tax.name ] || {
						templates: [],
						terms: {},
					};
					return (
						<PanelBody
							key={ tax.name }
							title={ tax.label }
							initialOpen={ false }
						>
							<TemplateSelect
								label={ sprintf(
									/* translators: %s taxonomy */ __(
										'Any post with a %s term',
										'schema-forge'
									),
									tax.label.toLowerCase()
								) }
								value={ conf.templates }
								templates={ templates }
								onChange={ ( ids ) =>
									update( ( r ) => ( {
										...r,
										taxonomies: {
											...r.taxonomies,
											[ tax.name ]: {
												...conf,
												templates: ids,
											},
										},
									} ) )
								}
							/>
							<TermRules
								taxonomy={ tax }
								conf={ conf }
								templates={ templates }
								onChange={ ( next ) =>
									update( ( r ) => ( {
										...r,
										taxonomies: {
											...r.taxonomies,
											[ tax.name ]: next,
										},
									} ) )
								}
							/>
						</PanelBody>
					);
				} ) }
			</Panel>

			<Panel
				header={ __( 'Archives and special pages', 'schema-forge' ) }
			>
				<PanelBody>
					{ Object.entries( archiveLabels ).map(
						( [ key, label ] ) => (
							<TemplateSelect
								key={ key }
								label={ label }
								value={ rules.archives[ key ] || [] }
								templates={ templates }
								onChange={ ( ids ) =>
									update( ( r ) => ( {
										...r,
										archives: {
											...r.archives,
											[ key ]: ids,
										},
									} ) )
								}
							/>
						)
					) }
				</PanelBody>
				<PanelBody
					title={ __( 'Post type archives', 'schema-forge' ) }
					initialOpen={ false }
				>
					{ config.postTypes
						.filter( ( p ) => p.hasArchive )
						.map( ( pt ) => (
							<TemplateSelect
								key={ pt.name }
								label={ sprintf(
									/* translators: %s post type */ __(
										'%s archive',
										'schema-forge'
									),
									pt.label
								) }
								value={
									rules.archives.post_type[ pt.name ] || []
								}
								templates={ templates }
								onChange={ ( ids ) =>
									update( ( r ) => ( {
										...r,
										archives: {
											...r.archives,
											post_type: {
												...r.archives.post_type,
												[ pt.name ]: ids,
											},
										},
									} ) )
								}
							/>
						) ) }
					{ ! config.postTypes.some( ( p ) => p.hasArchive ) && (
						<p className="schema-forge-muted">
							{ __(
								'No post types have archives.',
								'schema-forge'
							) }
						</p>
					) }
				</PanelBody>
				<PanelBody
					title={ __( 'Taxonomy archives', 'schema-forge' ) }
					initialOpen={ false }
				>
					<p className="description">
						{ __(
							'Applied on term archive pages. Specific-term rules (below) take precedence over the taxonomy-wide rule.',
							'schema-forge'
						) }
					</p>
					{ config.taxonomies.map( ( tax ) => (
						<TemplateSelect
							key={ tax.name }
							label={ sprintf(
								/* translators: %s taxonomy */ __(
									'Any %s archive',
									'schema-forge'
								),
								tax.label.toLowerCase()
							) }
							value={ rules.archives.taxonomy[ tax.name ] || [] }
							templates={ templates }
							onChange={ ( ids ) =>
								update( ( r ) => ( {
									...r,
									archives: {
										...r.archives,
										taxonomy: {
											...r.archives.taxonomy,
											[ tax.name ]: ids,
										},
									},
								} ) )
							}
						/>
					) ) }
					<TermArchiveRules
						rules={ rules }
						templates={ templates }
						update={ update }
					/>
				</PanelBody>
			</Panel>
		</div>
	);
}

function TermArchiveRules( { rules, templates, update } ) {
	const [ taxonomy, setTaxonomy ] = useState(
		config.taxonomies[ 0 ] ? config.taxonomies[ 0 ].name : ''
	);
	const tax = config.taxonomies.find( ( t ) => t.name === taxonomy );
	const { options, setQuery } = useTermSearch( tax ? tax.restBase : '' );
	const [ names, setNames ] = useState( {} );
	// Ids whose names were already requested, so a deleted term is fetched once rather than in a loop.
	const requested = useRef( new Set() );
	const termKeys = Object.keys( rules.archives.taxonomy ).filter( ( k ) =>
		k.startsWith( 'term:' )
	);

	const termKeyList = termKeys.join( ',' );

	useEffect( () => {
		// Resolve names across all taxonomies (cheap: one request per taxonomy that has term keys).
		const ids = termKeyList
			.split( ',' )
			.filter( Boolean )
			.map( ( k ) => Number( k.slice( 5 ) ) )
			.filter( ( id ) => ! requested.current.has( id ) );
		if ( ! ids.length ) {
			return;
		}
		ids.forEach( ( id ) => requested.current.add( id ) );
		config.taxonomies.forEach( ( t ) => {
			api.getTerms( t.restBase, ids )
				.then( ( terms ) => {
					if ( terms.length ) {
						setNames( ( n ) => ( {
							...n,
							...Object.fromEntries(
								terms.map( ( x ) => [
									x.id,
									`${ x.name } (${ t.label })`,
								] )
							),
						} ) );
					}
				} )
				.catch( () => {} );
		} );
	}, [ termKeyList ] );

	return (
		<div className="schema-forge-rules__terms">
			<Flex gap={ 2 } align="flex-end">
				<FlexItem style={ { flex: 1 } }>
					<SelectControl
						label={ __( 'Taxonomy', 'schema-forge' ) }
						value={ taxonomy }
						options={ config.taxonomies.map( ( t ) => ( {
							value: t.name,
							label: t.label,
						} ) ) }
						onChange={ setTaxonomy }
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
				</FlexItem>
				<FlexItem style={ { flex: 2 } }>
					<ComboboxControl
						label={ __(
							'Add a rule for a specific term archive',
							'schema-forge'
						) }
						value=""
						options={ options.filter(
							( o ) =>
								! rules.archives.taxonomy[ `term:${ o.value }` ]
						) }
						onFilterValueChange={ setQuery }
						onChange={ ( v ) => {
							if ( ! v ) {
								return;
							}
							const opt = options.find( ( o ) => o.value === v );
							if ( opt ) {
								setNames( ( n ) => ( {
									...n,
									[ v ]: `${ opt.label } (${ tax.label })`,
								} ) );
							}
							update( ( r ) => ( {
								...r,
								archives: {
									...r.archives,
									taxonomy: {
										...r.archives.taxonomy,
										[ `term:${ v }` ]: [],
									},
								},
							} ) );
						} }
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
				</FlexItem>
			</Flex>
			{ termKeys.map( ( key ) => (
				<div key={ key } className="schema-forge-rules__term">
					<Flex justify="space-between" align="center">
						<FlexItem>
							<strong>{ names[ key.slice( 5 ) ] || key }</strong>
						</FlexItem>
						<FlexItem>
							<Button
								size="small"
								variant="tertiary"
								isDestructive
								onClick={ () =>
									update( ( r ) => {
										const taxonomyRules = {
											...r.archives.taxonomy,
										};
										delete taxonomyRules[ key ];
										return {
											...r,
											archives: {
												...r.archives,
												taxonomy: taxonomyRules,
											},
										};
									} )
								}
							>
								{ __( 'Remove rule', 'schema-forge' ) }
							</Button>
						</FlexItem>
					</Flex>
					<TemplateSelect
						label={ __( 'Templates', 'schema-forge' ) }
						value={ rules.archives.taxonomy[ key ] }
						templates={ templates }
						onChange={ ( ids ) =>
							update( ( r ) => ( {
								...r,
								archives: {
									...r.archives,
									taxonomy: {
										...r.archives.taxonomy,
										[ key ]: ids,
									},
								},
							} ) )
						}
					/>
				</div>
			) ) }
		</div>
	);
}
