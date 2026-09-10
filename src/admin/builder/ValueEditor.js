import { useRef, useState } from '@wordpress/element';
import { Button, SelectControl, TextControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useBuilder, usePreviewTokens, useSelect } from './BuilderContext';
import TokenPicker from './TokenPicker';
import TypePicker from './TypePicker';
import NodeCard from './NodeCard';
import { CORE_REFS } from './refs';
import { graphNodes } from '../../shared/tree/selectors';
import { parseTokens } from '../../shared/tokens/parse';
import { getNodeRange, getRange, isEnumeration, getEnumMembers } from '../../shared/vocab';
import { useVocab } from '../hooks/useVocab';
import { config } from '../config';

function insertAtCaret( input, text, current ) {
	if ( ! input ) {
		return `${ current }${ text }`;
	}
	const start = input.selectionStart ?? current.length;
	const end = input.selectionEnd ?? current.length;
	return current.slice( 0, start ) + text + current.slice( end );
}

function ResolvedTokens( { text } ) {
	const tokens = usePreviewTokens();
	const found = parseTokens( text );
	if ( ! found.length || ! tokens || ! Object.keys( tokens ).length ) {
		return null;
	}
	return (
		<ul className="schema-forge-resolved" aria-label={ __( 'Resolved preview values', 'schema-forge' ) }>
			{ found.map( ( t, i ) => {
				const has = Object.prototype.hasOwnProperty.call( tokens, t.match );
				const value = tokens[ t.match ];
				let display;
				if ( ! has ) {
					display = null;
				} else if ( value === null || value === '' || ( Array.isArray( value ) && ! value.length ) ) {
					display = __( '(empty)', 'schema-forge' );
				} else if ( typeof value === 'object' ) {
					display = Array.isArray( value ) ? sprintf( /* translators: %d count */ __( '%d items', 'schema-forge' ), value.length ) : value.url || value.name || __( '(object)', 'schema-forge' );
				} else {
					display = String( value );
				}
				return (
					<li key={ i } className={ display === __( '(empty)', 'schema-forge' ) ? 'is-empty' : '' }>
						<code>{ t.match }</code> → { display === null ? <em>{ __( 'run preview', 'schema-forge' ) }</em> : <span>{ display.length > 80 ? display.slice( 0, 80 ) + '…' : display }</span> }
					</li>
				);
			} ) }
		</ul>
	);
}

function TextValue( { value, property, previewContext } ) {
	const { updateValue } = useBuilder();
	const { core } = useVocab();
	const inputRef = useRef( null );
	const enumType = property ? getRange( core, property.name ).find( ( r ) => isEnumeration( core, r ) ) : null;
	const members = enumType ? getEnumMembers( core, enumType ) : [];
	const listId = members.length ? `sf-enum-${ value.id }` : undefined;
	return (
		<div className="schema-forge-value__text">
			<div className="schema-forge-value__row">
				<TextControl
					ref={ inputRef }
					label={ __( 'Value', 'schema-forge' ) }
					hideLabelFromVision
					value={ value.value }
					onChange={ ( v ) => updateValue( value.id, { value: v } ) }
					placeholder={ members.length ? sprintf( /* translators: %s enumeration */ __( '%s member or {{token}}', 'schema-forge' ), enumType ) : __( 'Text or {{token}}', 'schema-forge' ) }
					list={ listId }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
				{ listId && (
					<datalist id={ listId }>
						{ members.map( ( m ) => <option key={ m } value={ `https://schema.org/${ m }` }>{ m }</option> ) }
					</datalist>
				) }
				<TokenPicker
					context={ previewContext }
					onInsert={ ( token ) => updateValue( value.id, { value: insertAtCaret( inputRef.current, token, value.value ) } ) }
				/>
			</div>
			<ResolvedTokens text={ value.value } />
		</div>
	);
}

function RefValue( { value } ) {
	const { state, updateValue } = useBuilder();
	const [ templates ] = useState( () => window.SchemaForgeTemplates || [] );
	const nodes = graphNodes( state.tree ).filter( ( n ) => {
		// Cannot reference an ancestor-less self reference on root property meaningfully but allow anything except own value's node.
		return true;
	} );
	const options = [
		{ value: '', label: __( 'Choose a reference…', 'schema-forge' ), disabled: true },
		...CORE_REFS.map( ( r ) => ( { value: r.target, label: ( config.hasYoast ? __( 'Yoast: ', 'schema-forge' ) : __( 'Site: ', 'schema-forge' ) ) + r.label } ) ),
		...nodes.map( ( n ) => ( { value: `node:${ n.id }`, label: sprintf( /* translators: %s type */ __( 'Node in this template: %s', 'schema-forge' ), n.type ) } ) ),
		...templates.filter( ( t ) => t.id !== state.loadedId ).map( ( t ) => ( { value: `template:${ t.id }`, label: sprintf( /* translators: 1: name 2: type */ __( 'Template: %1$s (%2$s)', 'schema-forge' ), t.name, t.rootType ) } ) ),
	];
	return (
		<SelectControl
			label={ __( 'Reference', 'schema-forge' ) }
			hideLabelFromVision
			value={ value.target || '' }
			options={ options }
			onChange={ ( v ) => updateValue( value.id, { target: v } ) }
			__nextHasNoMarginBottom
			__next40pxDefaultSize
		/>
	);
}

function NodeSlot( { value, property, previewContext } ) {
	const { state, nestNode } = useBuilder();
	const { core } = useVocab();
	if ( value.nodeId && state.tree.nodes[ value.nodeId ] ) {
		return <NodeCard nodeId={ value.nodeId } previewContext={ previewContext } />;
	}
	const suggested = property ? getNodeRange( core, property.name ) : [];
	return (
		<div className="schema-forge-value__slot" data-value-id={ value.id }>
			<TypePicker
				label={ value.kind === 'repeat' ? __( 'Type for each item', 'schema-forge' ) : __( 'Nested type', 'schema-forge' ) }
				value=""
				suggested={ suggested }
				onChange={ ( t ) => t && nestNode( value.id, t ) }
				help={ suggested.length ? sprintf( /* translators: %s types */ __( 'Suggested: %s. Or drop a type from the palette here.', 'schema-forge' ), suggested.slice( 0, 6 ).join( ', ' ) ) : __( 'Drop a type from the palette here or search.', 'schema-forge' ) }
			/>
		</div>
	);
}

function RepeatValue( { value, property, previewContext } ) {
	const { updateValue } = useBuilder();
	const inputRef = useRef( null );
	return (
		<div className="schema-forge-value__repeat">
			<div className="schema-forge-value__row">
				<TextControl
					ref={ inputRef }
					label={ __( 'Repeat over', 'schema-forge' ) }
					value={ value.source || '' }
					onChange={ ( v ) => updateValue( value.id, { source: v } ) }
					placeholder="{{acf.faqs}}"
					help={ __( 'A token that resolves to a list. Inside, use {{item.field}} or {{item.value}}.', 'schema-forge' ) }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
				<TokenPicker
					context={ previewContext }
					filterTypes={ [ 'rows', 'list', 'object' ] }
					onInsert={ ( token ) => updateValue( value.id, { source: insertAtCaret( inputRef.current, token, value.source || '' ) } ) }
				/>
			</div>
			<ResolvedTokens text={ value.source || '' } />
			<NodeSlot value={ value } property={ property } previewContext={ previewContext } />
		</div>
	);
}

const KIND_LABELS = {
	text: __( 'Text', 'schema-forge' ),
	node: __( 'Nested', 'schema-forge' ),
	ref: __( 'Reference', 'schema-forge' ),
	repeat: __( 'Repeat', 'schema-forge' ),
};

export default function ValueEditor( { valueId, property, index, total, previewContext } ) {
	const { state, removeValue, moveValue } = useBuilder();
	const value = state.tree.values[ valueId ];
	const [ isSelected, select ] = useSelect( 'value', valueId );
	if ( ! value ) {
		return null;
	}
	return (
		<div
			className={ `schema-forge-value schema-forge-value--${ value.kind }${ isSelected ? ' is-selected' : '' }` }
			onFocusCapture={ select }
			onClickCapture={ select }
		>
			<div className="schema-forge-value__meta">
				<span className="schema-forge-badge">{ KIND_LABELS[ value.kind ] }</span>
				{ total > 1 && (
					<span className="schema-forge-value__order">
						<Button size="small" icon="arrow-up-alt2" label={ __( 'Move value up', 'schema-forge' ) } disabled={ index === 0 } onClick={ () => moveValue( property.id, index, index - 1 ) } />
						<Button size="small" icon="arrow-down-alt2" label={ __( 'Move value down', 'schema-forge' ) } disabled={ index === total - 1 } onClick={ () => moveValue( property.id, index, index + 1 ) } />
					</span>
				) }
				<Button size="small" icon="no-alt" isDestructive label={ __( 'Remove value', 'schema-forge' ) } onClick={ () => removeValue( valueId ) } />
			</div>
			{ value.kind === 'text' && <TextValue value={ value } property={ property } previewContext={ previewContext } /> }
			{ value.kind === 'ref' && <RefValue value={ value } /> }
			{ value.kind === 'node' && <NodeSlot value={ value } property={ property } previewContext={ previewContext } /> }
			{ value.kind === 'repeat' && <RepeatValue value={ value } property={ property } previewContext={ previewContext } /> }
		</div>
	);
}
