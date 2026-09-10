import { Button, Flex, FlexItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { routeUrl } from '../router';

const NAV = [
	{ view: 'templates', label: __( 'Templates', 'schema-forge' ) },
	{ view: 'rules', label: __( 'Assignment rules', 'schema-forge' ) },
	{ view: 'settings', label: __( 'Settings', 'schema-forge' ) },
];

export default function Header( { route, navigate, children } ) {
	const active = route.view === 'builder' ? 'templates' : route.view;
	return (
		<header className="schema-forge-header">
			<Flex justify="space-between" align="center" wrap>
				<FlexItem>
					<h1 className="schema-forge-header__title">{ __( 'Schema Forge', 'schema-forge' ) }</h1>
				</FlexItem>
				<FlexItem>
					<nav aria-label={ __( 'Schema Forge sections', 'schema-forge' ) } className="schema-forge-nav">
						{ NAV.map( ( item ) => (
							<Button
								key={ item.view }
								href={ routeUrl( item.view ) }
								variant={ active === item.view ? 'primary' : 'tertiary' }
								aria-current={ active === item.view ? 'page' : undefined }
								onClick={ ( e ) => {
									e.preventDefault();
									navigate( item.view );
								} }
							>
								{ item.label }
							</Button>
						) ) }
					</nav>
				</FlexItem>
				{ children && <FlexItem>{ children }</FlexItem> }
			</Flex>
		</header>
	);
}
