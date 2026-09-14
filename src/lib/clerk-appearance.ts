// ---------------------------------------------------------------------------
// Clerk's components, wearing Taskey's clothes.
//
// The values are the tokens from globals.css. Clerk renders the sign-in form
// and the account menu, so if these drift the seams show. Left untyped on
// purpose: the shape is checked where it is passed to a Clerk component,
// which is where a wrong key would actually matter.
// ---------------------------------------------------------------------------

export const clerkAppearance = {
  variables: {
    colorPrimary: "#4f57d2",
    colorDanger: "#b3261e",
    colorSuccess: "#0b7a2f",
    colorWarning: "#8a5a00",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
    fontSize: "0.875rem",
  },
} as const;
