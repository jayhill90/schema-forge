import { useMemo, useState } from '@wordpress/element';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	SearchControl,
	TabPanel,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useVocab, describeType, describeProperty } from '../hooks/useVocab';
import { searchTypes, getGroup, getAllProperties } from '../../shared/vocab';
import { useBuilder } from './BuilderContext';
import { usedPropertyNames } from '../../shared/tree/selectors';

const COMMON_GROUPS = [
	[
		__( 'Content', 'schema-forge' ),
		[
			'Article',
			'BlogPosting',
			'NewsArticle',
			'TechArticle',
			'FAQPage',
			'Question',
			'Answer',
			'HowTo',
			'HowToStep',
			'Recipe',
			'VideoObject',
			'ImageObject',
			'WebPage',
			'BreadcrumbList',
			'ItemList',
		],
	],
	[
		__( 'Commerce', 'schema-forge' ),
		[
			'Product',
			'Offer',
			'AggregateOffer',
			'Review',
			'AggregateRating',
			'Brand',
			'Service',
			'JobPosting',
			'Course',
			'Event',
		],
	],
	[
		__( 'Organizations & places', 'schema-forge' ),
		[
			'Organization',
			'LocalBusiness',
			'Person',
			'PostalAddress',
			'ContactPoint',
			'OpeningHoursSpecification',
			'Place',
		],
	],
	[
		__( 'Technology & APIs', 'schema-forge' ),
		[
			'APIReference',
			'WebAPI',
			'SoftwareApplication',
			'WebApplication',
			'MobileApplication',
			'SoftwareSourceCode',
			'Dataset',
			'DataCatalog',
			'SearchAction',
			'EntryPoint',
		],
	],
];
const COMMON_TYPES = COMMON_GROUPS.flatMap( ( [ , names ] ) => names );

function DraggableType( { typeName, description, deprecated, children } ) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable( {
			id: `palette-type:${ typeName }`,
			data: { kind: 'type', typeName },
		} );
	return (
		<li
			ref={ setNodeRef }
			className={ `schema-forge-palette__item${ isDragging ? ' is-dragging' : '' }` }
			style={ { transform: CSS.Translate.toString( transform ) } }
			title={ description }
		>
			<span
				className="schema-forge-palette__handle"
				{ ...listeners }
				{ ...attributes }
				aria-label={ sprintf(
					/* translators: %s type */ __( 'Drag %s', 'schema-forge' ),
					typeName
				) }
				role="button"
				tabIndex={ 0 }
			>
				⠿
			</span>
			<span className="schema-forge-palette__label">
				{ typeName }
				{ deprecated && (
					<span className="schema-forge-palette__from">
						{ __( 'deprecated', 'schema-forge' ) }
					</span>
				) }
			</span>
			{ children }
		</li>
	);
}

function DraggableProperty( {
	name,
	from,
	own,
	deprecated,
	extension,
	description,
	onAdd,
} ) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable( {
			id: `palette-prop:${ name }`,
			data: { kind: 'property', name },
		} );
	return (
		<li
			ref={ setNodeRef }
			className={ `schema-forge-palette__item${ isDragging ? ' is-dragging' : '' }` }
			style={ { transform: CSS.Translate.toString( transform ) } }
			title={ description }
		>
			<span
				className="schema-forge-palette__handle"
				{ ...listeners }
				{ ...attributes }
				aria-label={ sprintf(
					/* translators: %s property */ __(
						'Drag %s',
						'schema-forge'
					),
					name
				) }
				role="button"
				tabIndex={ 0 }
			>
				⠿
			</span>
			<span className="schema-forge-palette__label">
				{ name }
				{ ! own && (
					<span className="schema-forge-palette__from">{ from }</span>
				) }
				{ deprecated && (
					<span className="schema-forge-palette__from">
						{ __( 'deprecated', 'schema-forge' ) }
					</span>
				) }
				{ extension && (
					<span className="schema-forge-palette__from">
						{ __( 'extension', 'schema-forge' ) }
					</span>
				) }
			</span>
			<Button
				size="small"
				variant="tertiary"
				onClick={ onAdd }
				label={ sprintf(
					/* translators: %s property */ __(
						'Add %s',
						'schema-forge'
					),
					name
				) }
			>
				{ __( 'Add', 'schema-forge' ) }
			</Button>
		</li>
	);
}

function TypesTab() {
	const { core, descriptions } = useVocab();
	const { state, setRootType, addValue, nestNode, select } = useBuilder();
	const [ query, setQuery ] = useState( '' );

	const results = useMemo( () => {
		if ( ! query.trim() ) {
			return COMMON_TYPES.filter( ( t ) => core.types[ t ] );
		}
		return searchTypes( core, query, { limit: 60 } );
	}, [ core, query ] );

	const grouped = useMemo( () => {
		if ( ! query.trim() ) {
			return COMMON_GROUPS.map( ( [ label, names ] ) => [
				label,
				names.filter( ( n ) => core.types[ n ] ),
			] ).filter( ( [ , names ] ) => names.length );
		}
		const map = new Map();
		for ( const name of results ) {
			const group = getGroup( core, name );
			if ( ! map.has( group ) ) {
				map.set( group, [] );
			}
			map.get( group ).push( name );
		}
		return [ ...map.entries() ];
	}, [ results, core, query ] );

	const sel = state.selection;
	const selectedProperty =
		sel && sel.kind === 'property' ? state.tree.properties[ sel.id ] : null;
	const selectedValue =
		sel && sel.kind === 'value' ? state.tree.values[ sel.id ] : null;
	const emptyNodeValue =
		selectedValue &&
		( selectedValue.kind === 'node' || selectedValue.kind === 'repeat' ) &&
		! selectedValue.nodeId
			? selectedValue
			: null;

	return (
		<div className="schema-forge-palette__tab">
			<SearchControl
				value={ query }
				onChange={ setQuery }
				label={ __( 'Search schema.org types', 'schema-forge' ) }
				placeholder={ __(
					'Search types (e.g. Product)',
					'schema-forge'
				) }
				__nextHasNoMarginBottom
			/>
			<p className="schema-forge-palette__hint">
				{ state.tree.rootId
					? __(
							'Drag a type onto a property to nest it, or use “Add”.',
							'schema-forge'
						)
					: __(
							'Drag a type onto the canvas or press “Add” to choose the root type.',
							'schema-forge'
						) }
			</p>
			{ grouped.map( ( [ group, names ] ) => (
				<div key={ group } className="schema-forge-palette__group">
					<h4>{ group }</h4>
					<ul>
						{ names.map( ( name ) => (
							<DraggableType
								key={ name }
								typeName={ name }
								deprecated={ Boolean(
									core.types[ name ] && core.types[ name ].x
								) }
								description={ describeType(
									descriptions,
									name
								) }
							>
								<DropdownMenu
									icon="plus-alt2"
									label={ sprintf(
										/* translators: %s type */ __(
											'Add %s',
											'schema-forge'
										),
										name
									) }
									toggleProps={ { size: 'small' } }
								>
									{ () => (
										<MenuGroup>
											<MenuItem
												onClick={ () => {
													setRootType( name );
												} }
											>
												{ state.tree.rootId
													? __(
															'Change root type to this',
															'schema-forge'
														)
													: __(
															'Use as root type',
															'schema-forge'
														) }
											</MenuItem>
											{ selectedProperty && (
												<MenuItem
													onClick={ () =>
														addValue(
															selectedProperty.id,
															'node',
															{ typeName: name }
														)
													}
												>
													{ sprintf(
														/* translators: %s property */ __(
															'Nest into “%s”',
															'schema-forge'
														),
														selectedProperty.name ||
															__(
																'selected property',
																'schema-forge'
															)
													) }
												</MenuItem>
											) }
											{ emptyNodeValue && (
												<MenuItem
													onClick={ () => {
														nestNode(
															emptyNodeValue.id,
															name
														);
														select( {
															kind: 'value',
															id: emptyNodeValue.id,
														} );
													} }
												>
													{ __(
														'Use for the selected empty slot',
														'schema-forge'
													) }
												</MenuItem>
											) }
										</MenuGroup>
									) }
								</DropdownMenu>
							</DraggableType>
						) ) }
					</ul>
				</div>
			) ) }
			{ ! results.length && (
				<p className="schema-forge-muted">
					{ __( 'No types match.', 'schema-forge' ) }
				</p>
			) }
		</div>
	);
}

function PropertiesTab() {
	const { core, descriptions } = useVocab();
	const { state, addProperty, select } = useBuilder();
	const [ query, setQuery ] = useState( '' );

	const sel = state.selection;
	let nodeId = state.tree.rootId;
	if ( sel ) {
		if ( sel.kind === 'node' ) {
			nodeId = sel.id;
		} else if (
			sel.kind === 'property' &&
			state.tree.properties[ sel.id ]
		) {
			nodeId = state.tree.properties[ sel.id ].nodeId;
		} else if ( sel.kind === 'value' && state.tree.values[ sel.id ] ) {
			const p =
				state.tree.properties[ state.tree.values[ sel.id ].propertyId ];
			nodeId = p ? p.nodeId : nodeId;
		}
	}
	const node = nodeId ? state.tree.nodes[ nodeId ] : null;
	const used = node ? usedPropertyNames( state.tree, node.id ) : [];

	const properties = useMemo( () => {
		if ( ! node ) {
			return [];
		}
		const q = query.trim().toLowerCase();
		return getAllProperties( core, node.type ).filter(
			( p ) => ! q || p.name.toLowerCase().includes( q )
		);
	}, [ core, node, query ] );

	if ( ! node ) {
		return (
			<p className="schema-forge-muted">
				{ __( 'Choose a root type first.', 'schema-forge' ) }
			</p>
		);
	}

	const add = ( name ) => {
		addProperty( node.id, name, {
			initialValue: { kind: 'text', value: '' },
		} );
	};

	return (
		<div className="schema-forge-palette__tab">
			<p className="schema-forge-palette__hint">
				{ sprintf(
					/* translators: %s type */ __(
						'Properties of %s. Drag onto a node card or press “Add”.',
						'schema-forge'
					),
					node.type
				) }
			</p>
			<SearchControl
				value={ query }
				onChange={ setQuery }
				label={ __( 'Search properties', 'schema-forge' ) }
				__nextHasNoMarginBottom
			/>
			<ul className="schema-forge-palette__list">
				{ properties.map( ( p ) => (
					<DraggableProperty
						key={ p.name }
						name={ p.name }
						from={ p.from }
						own={ p.own }
						deprecated={ p.deprecated }
						extension={ p.extension }
						description={ describeProperty( descriptions, p.name ) }
						onAdd={ () => {
							add( p.name );
							select( { kind: 'node', id: node.id } );
						} }
					/>
				) ) }
			</ul>
			{ ! properties.length && (
				<p className="schema-forge-muted">
					{ __(
						'No properties match. You can type a custom property name in the node card.',
						'schema-forge'
					) }
				</p>
			) }
			{ used.length > 0 && (
				<p className="schema-forge-muted">
					{ sprintf(
						/* translators: %d count */ __(
							'%d properties already on this node.',
							'schema-forge'
						),
						used.length
					) }
				</p>
			) }
		</div>
	);
}

export default function Palette() {
	return (
		<aside
			className="schema-forge-palette"
			aria-label={ __( 'Schema palette', 'schema-forge' ) }
		>
			<TabPanel
				tabs={ [
					{ name: 'types', title: __( 'Types', 'schema-forge' ) },
					{
						name: 'properties',
						title: __( 'Properties', 'schema-forge' ),
					},
				] }
			>
				{ ( tab ) =>
					tab.name === 'types' ? <TypesTab /> : <PropertiesTab />
				}
			</TabPanel>
		</aside>
	);
}
