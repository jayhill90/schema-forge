import apiFetch from '@wordpress/api-fetch';
import { config } from './config';

const base = `/${ config.restNamespace }`;

function query( params ) {
	const entries = Object.entries( params || {} ).filter(
		( [ , v ] ) => v !== undefined && v !== null && v !== ''
	);
	if ( ! entries.length ) {
		return '';
	}
	return (
		'?' +
		entries
			.map(
				( [ k, v ] ) =>
					`${ encodeURIComponent( k ) }=${ encodeURIComponent( v ) }`
			)
			.join( '&' )
	);
}

export const api = {
	listTemplates: () => apiFetch( { path: `${ base }/templates` } ),
	getTemplate: ( id ) => apiFetch( { path: `${ base }/templates/${ id }` } ),
	createTemplate: ( data ) =>
		apiFetch( { path: `${ base }/templates`, method: 'POST', data } ),
	updateTemplate: ( id, data ) =>
		apiFetch( {
			path: `${ base }/templates/${ id }`,
			method: 'PUT',
			data,
		} ),
	deleteTemplate: ( id ) =>
		apiFetch( { path: `${ base }/templates/${ id }`, method: 'DELETE' } ),
	duplicateTemplate: ( id ) =>
		apiFetch( {
			path: `${ base }/templates/${ id }/duplicate`,
			method: 'POST',
		} ),
	preview: ( data ) =>
		apiFetch( { path: `${ base }/preview`, method: 'POST', data } ),
	tokens: ( params ) =>
		apiFetch( { path: `${ base }/tokens${ query( params ) }` } ),
	getRules: () => apiFetch( { path: `${ base }/rules` } ),
	saveRules: ( data ) =>
		apiFetch( { path: `${ base }/rules`, method: 'PUT', data } ),
	getSettings: () => apiFetch( { path: `${ base }/settings` } ),
	saveSettings: ( data ) =>
		apiFetch( { path: `${ base }/settings`, method: 'PUT', data } ),
	resolve: ( params ) =>
		apiFetch( { path: `${ base }/resolve${ query( params ) }` } ),
	getAssignments: ( postId ) =>
		apiFetch( { path: `${ base }/posts/${ postId }/assignments` } ),
	saveAssignments: ( postId, data ) =>
		apiFetch( {
			path: `${ base }/posts/${ postId }/assignments`,
			method: 'PUT',
			data,
		} ),
	searchPosts: ( search, subtype = 'any' ) =>
		apiFetch( {
			path: `/wp/v2/search${ query( { search, type: 'post', subtype, per_page: 20 } ) }`,
		} ),
	searchTerms: ( restBase, search ) =>
		apiFetch( {
			path: `/wp/v2/${ restBase }${ query( { search, per_page: 20, hide_empty: false } ) }`,
		} ),
	getTerms: ( restBase, include ) =>
		apiFetch( {
			path: `/wp/v2/${ restBase }${ query( { include: include.join( ',' ), per_page: 100, hide_empty: false } ) }`,
		} ),
	searchUsers: ( search ) =>
		apiFetch( {
			path: `/wp/v2/users${ query( { search, per_page: 20 } ) }`,
		} ),
};

export function errorMessage( error, fallback ) {
	if ( error && typeof error === 'object' && error.message ) {
		return error.message;
	}
	return fallback;
}

export default api;
