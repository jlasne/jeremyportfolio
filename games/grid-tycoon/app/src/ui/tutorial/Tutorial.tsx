// PLACEHOLDER (UI shell track). The tutorial track replaces this file wholesale.
// Contract: default export, no props, always mounted inside the game screen (above the map and
// panels, below the results overlay). Stores: useUi (tutorialStep 0..4 or null, advanceTutorial,
// skipTutorial, panel/open to point at a panel), useGame (state.round, phase). Steps over rounds
// 1-3: allocate, build, read results, borrow, lock in (DESIGN.md section 4). Anchor bubbles to the
// rail tabs (#dock-tab-<panel>), the Lock in button (.lock-btn) and the results overlay.

export default function Tutorial() {
  return null
}
