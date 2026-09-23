import {
	FormTokenField,
	SelectControl,
	TextControl,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useBuilder } from './BuilderContext';
import TypePicker from './TypePicker';
import PropertyPicker from './PropertyPicker';
import { nodePath } from '../../shared/tree/selectors';
import { config } from '../config';

const DATA_TYPES = [
	{ value: 'auto', label: __( 'Auto (as resolved)', 'schema-forge' ) },
	{ value: 'text', label: __( 'Text', 'schema-forge' ) },
	{ value: 'url', label: __( 'URL', 'schema-forge' ) },
	{ value: 'number', label: __( 'Number', 'schema-forge' ) },
	{ value: 'integer', label: __( 'Integer', 'schema-forge' ) },
	{ value: 'boolean', label: __( 'Boolean', 'schema-forge' ) },
	{ value: 'date', label: __( 'Date (YYYY-MM-DD)', 'schema-forge' ) },
	{
		value: 'datetime',
		label: __( 'Date & time (ISO 8601)', 'schema-forge' ),
	},
	{ value: 'json', label: __( 'JSON (advanced)', 'schema-forge' ) },
];

const ON_EMPTY = [
	{ value: 'drop', label: __( 'Omit the property', 'schema-forge' ) },
	{ value: 'fallback', label: __( 'Use a fallback value', 'schema-forge' ) },
	{
		value: 'dropNode',
		label: __( 'Required: drop the whole node', 'schema-forge' ),
	},
];

function TemplateSettings() {
	const { state, setMeta, setSetting } = useBuilder();
	return (
		<div className="schema-forge-inspector__section">
			<h3>{ __( 'Template', 'schema-forge' ) }</h3>
			<TextareaControl
				label={ __( 'Description', 'schema-forge' ) }
				value={ state.meta.description }
				onChange={ ( v ) => setMeta( { description: v } ) }
				help={ __( 'Shown in the template list.', 'schema-forge' ) }
				__nextHasNoMarginBottom
			/>
			<ToggleControl
				label={ __( 'Enabled', 'schema-forge' ) }
				checked={ state.meta.enabled }
				onChange={ ( v ) => setMeta( { enabled: v } ) }
				help={ __(
					'Disabled templates never render, even when assigned.',
					'schema-forge'
				) }
				__nextHasNoMarginBottom
			/>
			<h3>
				{ config.hasYoast
					? __( 'Yoast SEO graph', 'schema-forge' )
					: __( 'Page graph', 'schema-forge' ) }
			</h3>
			<TextControl
				label={ __( 'WebPage @type override', 'schema-forge' ) }
				value={ state.settings.yoast.webPageType }
				onChange={ ( v ) => setSetting( 'yoast', 'webPageType', v ) }
				placeholder="ItemPage, FAQPage, CollectionPage…"
				help={ __(
					'Changes the page node’s type when this template renders.',
					'schema-forge'
				) }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			{ config.hasYoast && (
				<ToggleControl
					label={ __(
						'Suppress Yoast’s Article node',
						'schema-forge'
					) }
					checked={ state.settings.yoast.suppressArticle }
					onChange={ ( v ) =>
						setSetting( 'yoast', 'suppressArticle', v )
					}
					help={ __(
						'Useful when this template describes the page’s main entity itself (e.g. Product).',
						'schema-forge'
					) }
					__nextHasNoMarginBottom
				/>
			) }
			{ ! config.hasYoast && (
				<ToggleControl
					label={ __(
						'Include WebSite / WebPage / Organization nodes',
						'schema-forge'
					) }
					checked={ state.settings.standalone.includeCoreNodes }
					onChange={ ( v ) =>
						setSetting( 'standalone', 'includeCoreNodes', v )
					}
					__nextHasNoMarginBottom
				/>
			) }
		</div>
	);
}

function NodeOptions( { nodeId } ) {
	const { state, setNodeType, setNodeOption } = useBuilder();
	const node = state.tree.nodes[ nodeId ];
	if ( ! node ) {
		return null;
	}
	const isRoot = nodeId === state.tree.rootId;
	return (
		<div className="schema-forge-inspector__section">
			<h3>{ __( 'Node', 'schema-forge' ) }</h3>
			<p className="schema-forge-inspector__path">
				{ nodePath( state.tree, nodeId ).join( ' › ' ) }
			</p>
			<TypePicker
				value={ node.type }
				onChange={ ( t ) => t && setNodeType( nodeId, t ) }
				label={ __( 'Type', 'schema-forge' ) }
			/>
			<FormTokenField
				label={ __( 'Additional @type values', 'schema-forge' ) }
				value={ node.options.extraTypes }
				onChange={ ( tokens ) =>
					setNodeOption(
						nodeId,
						'extraTypes',
						tokens
							.map( ( t ) =>
								typeof t === 'string' ? t : t.value
							)
							.filter( ( t ) =>
								/^[A-Za-z0-9][A-Za-z0-9_]*$/.test( t )
							)
					)
				}
				__experimentalShowHowTo={ false }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			{ isRoot ? (
				<ToggleControl
					label={ __( 'Main entity of the page', 'schema-forge' ) }
					checked={ node.options.isMainEntity }
					onChange={ ( v ) =>
						setNodeOption( nodeId, 'isMainEntity', v )
					}
					help={ __(
						'Adds mainEntityOfPage and links WebPage.mainEntity to this node.',
						'schema-forge'
					) }
					__nextHasNoMarginBottom
				/>
			) : (
				<SelectControl
					label={ __( 'Placement', 'schema-forge' ) }
					value={ node.options.placement }
					options={ [
						{
							value: 'inline',
							label: __(
								'Inline (nested object)',
								'schema-forge'
							),
						},
						{
							value: 'graph',
							label: __(
								'Separate graph node with @id',
								'schema-forge'
							),
						},
					] }
					onChange={ ( v ) =>
						setNodeOption( nodeId, 'placement', v )
					}
					help={ __(
						'Graph nodes can be referenced from elsewhere in the template.',
						'schema-forge'
					) }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
			) }
			{ ( isRoot || node.options.placement === 'graph' ) && (
				<TextControl
					label={ __( '@id override', 'schema-forge' ) }
					value={ node.options.idOverride }
					onChange={ ( v ) =>
						setNodeOption( nodeId, 'idOverride', v )
					}
					placeholder={ sprintf(
						/* translators: %s type */ __(
							'Default: {page URL}#/schema/%s/{template id}',
							'schema-forge'
						),
						node.type.toLowerCase()
					) }
					help={ __(
						'Tokens allowed. A fragment (#brand) is appended to the page URL; a full URL is used as-is.',
						'schema-forge'
					) }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
			) }
		</div>
	);
}

function PropertyOptions( { propertyId } ) {
	const { state, updateProperty } = useBuilder();
	const property = state.tree.properties[ propertyId ];
	if ( ! property ) {
		return null;
	}
	const node = state.tree.nodes[ property.nodeId ];
	return (
		<div className="schema-forge-inspector__section">
			<h3>{ __( 'Property', 'schema-forge' ) }</h3>
			<PropertyPicker
				typeName={ node ? node.type : 'Thing' }
				value={ property.name }
				onChange={ ( name ) => updateProperty( propertyId, { name } ) }
			/>
			<SelectControl
				label={ __( 'Data type', 'schema-forge' ) }
				value={ property.dataType }
				options={ DATA_TYPES }
				onChange={ ( v ) =>
					updateProperty( propertyId, { dataType: v } )
				}
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			<SelectControl
				label={ __( 'When the value is empty', 'schema-forge' ) }
				value={ property.onEmpty }
				options={ ON_EMPTY }
				onChange={ ( v ) =>
					updateProperty( propertyId, { onEmpty: v } )
				}
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			{ property.onEmpty === 'fallback' && (
				<TextControl
					label={ __( 'Fallback value', 'schema-forge' ) }
					value={ property.fallback }
					onChange={ ( v ) =>
						updateProperty( propertyId, { fallback: v } )
					}
					help={ __(
						'Tokens allowed, e.g. {{site.name}}.',
						'schema-forge'
					) }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
			) }
		</div>
	);
}

function ValueOptions( { valueId } ) {
	const { state, updateValue } = useBuilder();
	const value = state.tree.values[ valueId ];
	if ( ! value ) {
		return null;
	}
	return (
		<div className="schema-forge-inspector__section">
			<h3>{ __( 'Value', 'schema-forge' ) }</h3>
			{ value.kind === 'text' && (
				<ToggleControl
					label={ __(
						'Keep partial text when a token is empty',
						'schema-forge'
					) }
					checked={ Boolean( value.allowPartial ) }
					onChange={ ( v ) =>
						updateValue( valueId, { allowPartial: v } )
					}
					help={ __(
						'By default a mixed text is dropped entirely if any token resolves empty.',
						'schema-forge'
					) }
					__nextHasNoMarginBottom
				/>
			) }
			{ value.kind !== 'text' && (
				<p className="schema-forge-muted">
					{ __(
						'Edit this value directly on the canvas.',
						'schema-forge'
					) }
				</p>
			) }
		</div>
	);
}

export default function Inspector() {
	const { state } = useBuilder();
	const sel = state.selection;
	let propertyId = null;
	let nodeId = null;
	if ( sel && sel.kind === 'value' && state.tree.values[ sel.id ] ) {
		propertyId = state.tree.values[ sel.id ].propertyId;
	} else if ( sel && sel.kind === 'property' ) {
		propertyId = sel.id;
	}
	if ( propertyId && state.tree.properties[ propertyId ] ) {
		nodeId = state.tree.properties[ propertyId ].nodeId;
	} else if ( sel && sel.kind === 'node' ) {
		nodeId = sel.id;
	}

	return (
		<div className="schema-forge-inspector">
			{ sel && sel.kind === 'value' && (
				<ValueOptions valueId={ sel.id } />
			) }
			{ propertyId && <PropertyOptions propertyId={ propertyId } /> }
			{ nodeId && <NodeOptions nodeId={ nodeId } /> }
			<TemplateSettings />
		</div>
	);
}
