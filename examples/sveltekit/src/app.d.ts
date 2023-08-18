// See https://kit.svelte.dev/docs/types#app

import type { NhostClient, NhostSession } from '@nhost/nhost-js';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {}
		interface PageData {}
		// interface Platform {}
	}
}

export {};
