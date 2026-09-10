const base = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...base,
	rootDir: __dirname,
	testMatch: [ '<rootDir>/tests/js/**/*.test.[jt]s', '<rootDir>/tests/js/**/*.test.mjs' ],
	moduleFileExtensions: [ ...( base.moduleFileExtensions || [ 'js', 'json' ] ), 'mjs' ],
	transform: {
		'^.+\\.(js|mjs|jsx|ts|tsx)$': require.resolve( '@wordpress/scripts/config/babel-transform' ),
	},
};
