/* Split-Flap OS sidebar panel entry point. */

import { PANEL_ELEMENT } from "./constants.js?v=1.2.11";
import { PanelMixin as PanelCore } from "./panel/core.js?v=1.2.11";
import { PanelMixin as PanelFlapDisplay } from "./panel/flap-display.js?v=1.2.11";
import { PanelMixin as PanelControl } from "./panel/views/control.js?v=1.2.11";
import { PanelMixin as PanelPlaylists } from "./panel/views/playlists.js?v=1.2.11";
import { PanelMixin as PanelApps } from "./panel/views/apps.js?v=1.2.11";
import { PanelMixin as PanelTuning } from "./panel/views/tuning.js?v=1.2.11";
import { PanelMixin as PanelSettings } from "./panel/views/settings.js?v=1.2.11";
import { PanelMixin as PanelComponents } from "./panel/components.js?v=1.2.11";
import { PanelMixin as PanelActions } from "./panel/actions.js?v=1.2.11";

class SplitFlapOSPanel extends PanelActions(
  PanelComponents(
    PanelSettings(
      PanelTuning(
        PanelApps(
          PanelPlaylists(PanelControl(PanelFlapDisplay(PanelCore(HTMLElement))))
        )
      )
    )
  )
) {}

if (!customElements.get(PANEL_ELEMENT)) {
  customElements.define(PANEL_ELEMENT, SplitFlapOSPanel);
}
