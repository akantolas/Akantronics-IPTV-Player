const PROXY_PREFIX = "/dev-xtream-proxy?url=";

function shouldProxy(url: string): boolean {
  return url.includes("player_api.php");
}

export function createAppFetch(): typeof fetch {
  if (!import.meta.env.DEV) {
    return fetch.bind(globalThis);
  }

  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (shouldProxy(url)) {
      return fetch(`${PROXY_PREFIX}${encodeURIComponent(url)}`, init);
    }
    return fetch(input, init);
  };
}
