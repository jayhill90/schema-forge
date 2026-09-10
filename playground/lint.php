<?php
// Syntax-check every PHP file in the plugin using the Playground PHP binary.
$root = getenv('SF_LINT_ROOT') ?: '/plugin';
$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ) );
$errors = 0; $count = 0;
foreach ( $it as $file ) {
	$path = $file->getPathname();
	if ( substr( $path, -4 ) !== '.php' || str_contains( $path, '/node_modules/' ) || str_contains( $path, '/build/' ) || str_ends_with( $path, '/lint.php' ) ) {
		continue;
	}
	++$count;
	$code = file_get_contents( $path );
	// php -l equivalent: try compiling via token_get_all + eval-free check using PhpToken? Use a subprocess-free approach:
	$tmp = tempnam( sys_get_temp_dir(), 'lint' );
	file_put_contents( $tmp, $code );
	ob_start();
	$ok = @php_check_syntax_polyfill( $tmp );
	ob_end_clean();
	if ( ! $ok ) {
		++$errors;
		echo "SYNTAX ERROR: $path\n";
	}
}
function php_check_syntax_polyfill( string $file ): bool {
	// PHP >= 8: use the lint mode of the engine via opcache_compile_file when available, else fall back to a shell-less approach.
	if ( function_exists( 'opcache_compile_file' ) ) {
		try { return @opcache_compile_file( $file ); } catch ( \Throwable $e ) { echo $e->getMessage(), "\n"; return false; }
	}
	try {
		// Wrap in a closure that is never executed; compile errors surface as ParseError.
		$src = file_get_contents( $file );
		$src = preg_replace( '/^<\?php\s*declare\(strict_types=1\);/', '<?php', $src, 1 );
		eval( 'return true; ?>' . $src ); // phpcs:ignore
		return true;
	} catch ( \ParseError $e ) {
		echo $e->getMessage(), ' line ', $e->getLine(), "\n";
		return false;
	} catch ( \Throwable $e ) {
		return true; // runtime errors (e.g. redeclare) are not syntax errors
	}
}
echo "$count files, $errors syntax errors\n";
if ( $errors ) { exit( 1 ); }
