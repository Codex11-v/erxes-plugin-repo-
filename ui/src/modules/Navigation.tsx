import {
  IconBrain,
  IconSettings,
  IconMicrophone,
  IconPresentation,
  IconScan,
} from "@tabler/icons-react";
// Root import on purpose: core-ui shares `erxes-ui` as a Module Federation
// singleton keyed on the bare specifier, so deep imports would bundle a second
// private copy instead of reusing the host's.
import { NavigationMenuLinkItem, Sidebar } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };

export const Navigation = () => (
  <Sidebar.Group>
    <Sidebar.GroupContent>
      <Sidebar.Menu>
        <NavigationMenuLinkItem
          name={manifest.title}
          icon={IconBrain}
          path={`/${manifest.ui.path}`}
        />
        <NavigationMenuLinkItem
          name="Voice → Report"
          icon={IconMicrophone}
          path={`/${manifest.ui.path}/voice`}
        />
        <NavigationMenuLinkItem
          name="Lesson & Slides"
          icon={IconPresentation}
          path={`/${manifest.ui.path}/lessons`}
        />
        <NavigationMenuLinkItem
          name="Image → Excel"
          icon={IconScan}
          path={`/${manifest.ui.path}/ocr`}
        />
        <NavigationMenuLinkItem
          name="Settings"
          icon={IconSettings}
          path={`/${manifest.ui.path}/settings`}
        />
      </Sidebar.Menu>
    </Sidebar.GroupContent>
  </Sidebar.Group>
);
