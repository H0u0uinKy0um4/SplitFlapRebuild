/* Split-Flap OS sidebar panel entry point. */

import { PANEL_ELEMENT } from "./constants.js?v=1.2.2";
import { PanelMixin as PanelCore } from "./panel/core.js?v=1.2.2";
import { PanelMixin as PanelRender } from "./panel/render.js?v=1.2.2";
import { PanelMixin as PanelActions } from "./panel/actions.js?v=1.2.2";

class SplitFlapOSPanel extends PanelActions(PanelRender(PanelCore(HTMLElement))) {}

if (!customElements.get(PANEL_ELEMENT)) {
  customElements.define(PANEL_ELEMENT, SplitFlapOSPanel);
}
