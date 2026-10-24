import "./styles.css";
import "./hub.css";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppLayout } from "erxes-ui";
import manifest from "../../erxes.json" with { type: "json" };
import { Navigation } from "./modules/Navigation";
import { ToolPage } from "./pages/ToolPage";
import { Link } from "react-router";

const IndexPage = lazy(() =>
  import("./pages/IndexPage").then((module) => ({
    default: module.IndexPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

// core-ui mounts this component at `/<path>/*`; routes below are relative to
// it. It resolves the component by the PascalCase expose name.
export const Edusmart = () => (
  <AppLayout id={manifest.name} title={manifest.title} sidebar={<Navigation />}>
    <div className="edusmart:compass edusmart:h-full edusmart:overflow-auto edusmart:bg-background edusmart:text-foreground">
      <Suspense fallback={<div role="status">Loading…</div>}>
        <Routes>
          <Route index element={<IndexPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="voice" element={<ToolPage key="voice" kind="voice" />} />
          <Route path="lessons" element={<ToolPage key="lessons" kind="lessons" />} />
          <Route path="ocr" element={<ToolPage key="ocr" kind="ocr" />} />
          <Route
            path="*"
            element={
              <div className="edusmart:p-8">
                Page not found. <Link to="/edusmart">Back to home</Link>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </div>
  </AppLayout>
);
