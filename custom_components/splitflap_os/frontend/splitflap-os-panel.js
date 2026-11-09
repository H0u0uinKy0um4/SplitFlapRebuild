/* Split-Flap OS sidebar panel entry point. */

import { PANEL_ELEMENT } from "./constants.js";
import { PanelMixin as PanelCore } from "./panel/core.js";
import { PanelMixin as PanelRender } from "./panel/render.js";
import { PanelMixin as PanelActions } from "./panel/actions.js";

class SplitFlapOSPanel extends PanelActions(PanelRender(PanelCore(HTMLElement))) {}

if (!customElements.get(PANEL_ELEMENT)) {
  customElements.define(PANEL_ELEMENT, SplitFlapOSPanel);
}
