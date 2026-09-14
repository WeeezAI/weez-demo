// routes/retired.ts
//
// The retired destinations, in one place.
//
// Four paths stay registered in `App.tsx` so a bookmark or a shared link still lands
// somewhere sensible — `/relationship-intelligence/:spaceId` redirects to the dossier, the
// other three remain reachable by direct URL — but none of them may be *offered*. They are
// absent from the navigation sidebar, from in-page cross-links, from empty-state calls to
// action and from every `navigate()` target on the restructured surfaces.
//
// "Absent" is a claim that rots under review, so it is asserted by test instead: a surface
// scan checks every rendered anchor, control and navigation target against this one
// vocabulary. Keeping the list here rather than restating it per suite is what stops a
// surface from drifting back onto a path the restructure took out of the mental model.
//
// Two known call sites are removed by this rule: `ProspectIntelligence`'s
// `onOpenRelationshipIntelligence` prop and its `onOpenMax` control.

/**
 * The retired paths for one workspace, in the order the design declares them.
 *
 * @param spaceId - The workspace identifier the paths are scoped to.
 * @returns `/gtm-dashboard/{id}`, `/sales/{id}`, `/sales-workspace-legacy/{id}` and
 *   `/relationship-intelligence/{id}`.
 */
export const retiredPathsFor = (spaceId: string): readonly string[] => [
  `/gtm-dashboard/${spaceId}`,
  `/sales/${spaceId}`,
  `/sales-workspace-legacy/${spaceId}`,
  `/relationship-intelligence/${spaceId}`,
];
