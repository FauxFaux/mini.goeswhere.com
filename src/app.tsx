import { HomeIcon, IterationsIcon, MarkGithubIcon as IconGithub } from "@primer/octicons-react";
import { useEffect, useState } from "preact/hooks";
import { Link, Route, Router, Switch, useLocation } from "wouter";
import { CrashHandler } from "./boot/crash-handler.tsx";
import { navigateHash, useMiniLocation, useMiniSearch } from "./boot/hash-location.ts";
import { Home } from "./pages/home.tsx";
import { tools } from "./tools/registry.ts";

export function App() {
  return (
    <Router hook={useMiniLocation} searchHook={useMiniSearch}>
      <AppRoutes />
    </Router>
  );
}

function AppRoutes() {
  const [path] = useLocation();
  const [resetCount, setResetCount] = useState(0);
  const tool = tools.find((item) => item.path === path);
  useEffect(() => {
    document.title = `${tool?.title ?? (path === "/" ? "Mini tools" : "Tool not found")} · mini.goeswhere.com`;
  }, [path, tool]);

  return (
    <>
      <header class={path === "/earth-moon" ? "earth-moon-navigation" : undefined}>
        <nav aria-label="Main navigation">
          {path === "/earth-moon" ? (
            <>
              <Link href="/" aria-label="All tools" title="All tools">
                <HomeIcon size={20} aria-hidden="true" />
              </Link>
              <button
                aria-label="Reset Earth–Moon"
                title="Reset Earth–Moon"
                onClick={() => {
                  navigateHash("/earth-moon", { replace: true });
                  setResetCount((count) => count + 1);
                }}
              >
                <IterationsIcon size={20} aria-hidden="true" />
              </button>
            </>
          ) : (
            <Link href="/">mini.goeswhere.com</Link>
          )}
        </nav>
      </header>
      <main>
        <CrashHandler resetPath={path} resetKey={path}>
          <Switch>
            <Route path="/" component={Home} />
            {tools.map((item) => (
              <Route
                key={`${item.path}:${resetCount}`}
                path={item.path}
                component={item.component}
              />
            ))}
            <Route>
              <h1>Tool not found</h1>
              <p>
                <Link href="/">Browse available tools</Link>.
              </p>
            </Route>
          </Switch>
        </CrashHandler>
      </main>
      <footer>
        {path === "/earth-moon" && (
          <p class="muted">
            Earth and Moon textures by{" "}
            <a href="https://www.solarsystemscope.com/textures/">Solar System Scope</a> (
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>).
          </p>
        )}
        <a
          href="https://github.com/FauxFaux/mini.goeswhere.com"
          aria-label="Source on GitHub"
          title="Source on GitHub"
        >
          <IconGithub size={24} aria-hidden="true" />
        </a>
      </footer>
    </>
  );
}
