import { useHashLocation } from "wouter/use-hash-location";

export function splitHash(hash: string): { path: string; search: string } {
  const route = hash.replace(/^#?\/?/, "");
  const query = route.indexOf("?");
  return {
    path: `/${query < 0 ? route : route.slice(0, query)}`,
    search: query < 0 ? "" : route.slice(query + 1),
  };
}

// Wouter's stock hash navigator puts queries in location.search. Our tools keep the
// complete route and state after '#', so static hosting needs no server routing.
export function navigateHash(to: string, { replace = false } = {}): void {
  const oldURL = window.location.href;
  const url = new URL(oldURL);
  url.hash = `/${to.replace(/^#?\/?/, "")}`;
  if (url.href === oldURL) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: url.href }));
}

export function useMiniLocation(): [string, typeof navigateHash] {
  const [hash] = useHashLocation();
  return [splitHash(hash).path, navigateHash];
}

export function useMiniSearch(): string {
  const [hash] = useHashLocation();
  return splitHash(hash).search;
}

useMiniLocation.hrefs = (href: string) => `#${href}`;
