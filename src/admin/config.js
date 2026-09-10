const defaults = {
	restNamespace: 'schema-forge/v1',
	restRoot: '',
	adminUrl: '',
	vocabUrl: '',
	vocabDescUrl: '',
	vocabVersion: '',
	pluginVersion: '',
	postTypes: [],
	taxonomies: [],
	hasYoast: false,
	hasAcf: false,
	siteName: '',
	siteUrl: '',
	canManage: false,
	showOnFront: 'posts',
};

export const config = { ...defaults, ...( typeof window !== 'undefined' && window.SchemaForgeConfig ? window.SchemaForgeConfig : {} ) };

export default config;
