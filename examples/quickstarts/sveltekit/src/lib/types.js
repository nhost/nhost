/**
 * @typedef {Object} Attachment
 * @property {string} id
 */

/**
 * @typedef {Object} Todo
 * @property {string} id
 * @property {string} title
 * @property {boolean} done
 * @property {Attachment} attachment
 */

/**
 * @typedef {Object} PersonalAccessToken
 * @property {string} id
 * @property {Record<string, string>} metadata
 * @property {string} type
 * @property {string} expiresAt
 */

export const Types = {}