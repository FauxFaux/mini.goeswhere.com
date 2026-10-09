import { MarkGithubIcon as IconGithub } from "@primer/octicons-react";
import { useEffect } from "preact/hooks";
import { Link, Route, Router, Switch, useLocation } from "wouter";
import { CrashHandler } from "./boot/crash-handler.tsx";
import { useMiniLocation, useMiniSearch } from "./boot/hash-location.ts";
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
  const tool = tools.find((item) => item.path === path);
  useEffect(() => {
    document.title = `${tool?.title ?? (path === "/" ? "Mini tools" : "Tool not found")} · mini.goeswhere.com`;
  }, [path, tool]);

  return (
    <>
      <header>
        <nav aria-label="Main navigation">
          <Link href="/">mini.goeswhere.com</Link>
        </nav>
      </header>
      <main>
        <CrashHandler resetPath={path} resetKey={path}>
          <Switch>
            <Route path="/" component={Home} />
            {tools.map((item) => (
              <Route key={item.path} path={item.path} component={item.component} />
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
