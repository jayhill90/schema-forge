import { useMemo, useState } from '@wordpress/element';
import { ComboboxControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useVocab, describeType } from '../hooks/useVocab';
import { searchTypes, hasType } from '../../shared/vocab';

/**
 * Searchable schema.org type picker. Accepts custom (unknown) type names too.
 *
 * @param {Object}                props
 * @param {string}                props.value        Selected type name.
 * @param {function(string):void} props.onChange     Called with the chosen type name.
 * @param {string}                [props.label]      Field label; defaults to "Type".
 * @param {string}                [props.help]       Help text; defaults to the type's description.
 * @param {string[]}              [props.suggested]  Types to list first when the search is empty.
 * @param {boolean}               [props.allowEmpty] Allow clearing the selection.
 * @return {Element} The combobox.
 */
export default function TypePicker( {
	value,
	onChange,
	label,
	help,
	suggested = [],
	allowEmpty = false,
} ) {
	const { core, descriptions } = useVocab();
	const [ query, setQuery ] = useState( '' );

	const options = useMemo( () => {
		const names = searchTypes( core, query, { limit: 30 } );
		const list = [];
		const seen = new Set();
		if ( ! query ) {
			for ( const s of suggested ) {
				if ( ! seen.has( s ) && hasType( core, s ) ) {
					seen.add( s );
					list.push( { value: s, label: `★ ${ s }` } );
				}
			}
		}
		for ( const n of names ) {
			if ( ! seen.has( n ) ) {
				seen.add( n );
				const t = core.types[ n ];
				list.push( {
					value: n,
					label:
						t && t.x
							? `${ n } — ${ __( 'deprecated', 'schema-forge' ) }${ t.sb && t.sb.length ? ` → ${ t.sb.join( ', ' ) }` : '' }`
							: n,
				} );
			}
		}
		if ( value && ! seen.has( value ) ) {
			list.unshift( { value, label: value } );
		}
		const custom = query.trim();
		if (
			custom &&
			/^[A-Za-z0-9][A-Za-z0-9_]*$/.test( custom ) &&
			! seen.has( custom )
		) {
			list.push( {
				value: custom,
				label: sprintf(
					/* translators: %s type name */ __(
						'Use custom type “%s”',
						'schema-forge'
					),
					custom
				),
			} );
		}
		return list;
	}, [ core, query, suggested, value ] );

	const description = value ? describeType( descriptions, value ) : '';

	return (
		<ComboboxControl
			label={ label || __( 'Type', 'schema-forge' ) }
			value={ value || '' }
			options={ options }
			onChange={ ( v ) => {
				if ( v || allowEmpty ) {
					onChange( v || '' );
				}
			} }
			onFilterValueChange={ setQuery }
			help={ help || description || undefined }
			allowReset={ allowEmpty }
			__nextHasNoMarginBottom
			__next40pxDefaultSize
		/>
	);
}
