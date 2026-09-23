import { defineConfig } from 'vitest/config';

// Unit tests are plain JavaScript run in Node (no DOM, no JSX).
export default defineConfig( {
	test: {
		environment: 'node',
		globals: false,
		restoreMocks: true,
		include: [ 'tests/js/**/*.test.{js,mjs}' ],
	},
} );
