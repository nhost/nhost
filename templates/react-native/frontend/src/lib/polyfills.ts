// Runs before anything imports the SDK. Hermes already has the TextEncoder,
// TextDecoder, atob, btoa, URL and URLSearchParams the SDK uses. It has no
// `crypto`, which only the SDK's PKCE helper needs, so the app derives PKCE
// pairs with expo-crypto instead of installing a global.
export {};
