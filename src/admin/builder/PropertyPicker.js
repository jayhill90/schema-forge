import { useMemo, useState } from '@wordpress/element';
import { ComboboxControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useVocab, describeProperty } from '../hooks/useVocab';
import { searchProperties, getRange } from '../../shared/vocab';

export default function PropertyPicker( {
	typeName,
	value,
	onChange,
	label,
	exclude = [],
} ) {
	const { core, descriptions } = useVocab();
	const [ query, setQuery ] = useState( '' );

	const options = useMemo( () => {
		const list = searchProperties( core, typeName, query, 40 )
			.filter( ( p ) => p.name === value || ! exclude.includes( p.name ) )
			.map( ( p ) => {
				let optionLabel = p.own ? p.name : `${ p.name } (${ p.from })`;
				if ( p.deprecated ) {
					optionLabel += ` — ${ __( 'deprecated', 'schema-forge' ) }${ p.replacedBy.length ? ` → ${ p.replacedBy.join( ', ' ) }` : '' }`;
				}
				return { value: p.name, label: optionLabel };
			} );
		const seen = new Set( list.map( ( o ) => o.value ) );
		if ( value && ! seen.has( value ) ) {
			list.unshift( { value, label: value } );
		}
		const custom = query.trim();
		if (
			custom &&
			/^[a-z][A-Za-z0-9_-]*$/.test( custom ) &&
			! seen.has( custom )
		) {
			list.push( {
				value: custom,
				label: sprintf(
					/* translators: %s property name */ __(
						'Use custom property “%s”',
						'schema-forge'
					),
					custom
				),
			} );
		}
		return list;
	}, [ core, typeName, query, value, exclude ] );

	const range = value ? getRange( core, value ) : [];
	const help = value
		? [
				describeProperty( descriptions, value ),
				range.length
					? sprintf(
							/* translators: %s list of types */ __(
								'Expects: %s',
								'schema-forge'
							),
							range.join( ', ' )
						)
					: '',
			]
				.filter( Boolean )
				.join( ' — ' )
		: undefined;

	return (
		<ComboboxControl
			label={ label || __( 'Property', 'schema-forge' ) }
			value={ value || '' }
			options={ options }
			onChange={ ( v ) => v && onChange( v ) }
			onFilterValueChange={ setQuery }
			help={ help }
			__nextHasNoMarginBottom
			__next40pxDefaultSize
		/>
	);
}
