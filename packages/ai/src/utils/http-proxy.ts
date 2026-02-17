/**
 * Set up HTTP proxy according to env variables for `fetch` based SDKs in Node.js.
 * Bun has builtin support for this.
 *
 * This module should be imported early by any code that needs proxy support for fetch().
 * ES modules are cached, so importing multiple times is safe - setup only runs once.
 */
export function hasHttpProxyEnv(env: NodeJS.ProcessEnv = process.env): boolean {
	return Boolean(
		env.HTTP_PROXY || env.HTTPS_PROXY || env.ALL_PROXY || env.http_proxy || env.https_proxy || env.all_proxy,
	);
}

if (typeof process !== "undefined" && process.versions?.node && hasHttpProxyEnv()) {
	import("undici")
		.then((m) => {
			const { EnvHttpProxyAgent, setGlobalDispatcher } = m;
			setGlobalDispatcher(new EnvHttpProxyAgent());
		})
		.catch((error) => {
			const details = error instanceof Error ? error.message : String(error);
			console.warn(`[pi-ai] Failed to configure HTTP proxy dispatcher: ${details}`);
		});
}
