// ---------------------------------------------------------------------------
// Clerk's components, wearing Taskey's clothes.
//
// Clerk renders two real screens in this app: the sign-in form, and the
// sign-in and security panel on your account page. They are the only surfaces
// somebody else designed, so without this they read as a widget dropped into
// the page: a different button shape, a different field, a different idea of
// what a card is.
//
// Two halves to it. The variables give Clerk the palette and the type from
// globals.css, which is what its own internals compute all their shades from.
// The elements then hand specific parts the app's actual classes, `.btn` and
// `.field`, rather than a description of them, so a change to a button in
// globals.css reaches the sign-in page too instead of quietly drifting from it.
//
// Clerk's own styles are put in a `clerk` CSS layer, declared before Tailwind
// in globals.css, so these classes win without a single `!important`.
// ---------------------------------------------------------------------------

/** The tokens, spelled out: Clerk cannot read a CSS custom property here. */
const token = {
  accent: "#4f57d2",
  accentInk: "#3a41ab",
  ink: "#1a1c2b",
  muted: "#6b6e85",
  faint: "#9a9db4",
  surface: "#ffffff",
  sunken: "#f4f5fa",
  line: "#e8e9f2",
  ok: "#0b7a2f",
  warn: "#8a5a00",
  danger: "#b3261e",
} as const;

export const clerkAppearance = {
  variables: {
    colorPrimary: token.accent,
    colorPrimaryForeground: "#ffffff",
    colorForeground: token.ink,
    colorMutedForeground: token.muted,
    colorMuted: token.sunken,
    colorBackground: token.surface,
    colorInput: token.sunken,
    colorInputForeground: token.ink,
    colorBorder: token.line,
    colorRing: "rgba(79, 87, 210, 0.4)",
    colorShadow: "rgba(26, 28, 43, 0.1)",
    colorDanger: token.danger,
    colorSuccess: token.ok,
    colorWarning: token.warn,
    fontFamily: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
    fontSize: "0.875rem",
    // The app rounds boxes at 12px and pills its buttons; the buttons get
    // their radius from `.btn` below, so this is the box radius.
    borderRadius: "0.75rem",
    // Clerk's own rules go in this layer. globals.css declares it ahead of
    // Tailwind, which is what lets a plain utility class here beat them.
    cssLayerName: "clerk",
  },

  elements: {
    // --- the shell ---------------------------------------------------------
    // On the account page this is a panel standing on the tinted ground, so
    // it wears the app's card. On the sign-in page it is already inside a
    // white column and globals.css flattens it away to nothing.
    rootBox: "w-full",
    cardBox: "w-full max-w-none rounded-2xl shadow-none",
    card: "w-full shadow-none gap-5",
    header: "gap-1",
    headerTitle: "text-[17px] font-bold tracking-tight text-ink",
    headerSubtitle: "text-[13px] text-muted",
    main: "gap-5",

    // --- the way in --------------------------------------------------------
    socialButtons: "gap-2",
    socialButtonsBlockButton:
      "btn btn-ghost btn-md w-full justify-center gap-2 border-0 shadow-none",
    socialButtonsBlockButtonText: "text-[13px] font-medium text-ink",

    dividerRow: "my-1 gap-3",
    dividerText: "text-[11px] font-semibold uppercase tracking-[0.08em] text-faint",

    // --- the form ----------------------------------------------------------
    form: "gap-4",
    formFieldRow: "gap-3",
    formFieldLabel: "text-[12px] font-semibold text-ink",
    formFieldInput: "field h-10 shadow-none",
    formFieldAction: "text-[12px] font-medium text-accent hover:text-accent-ink",
    formFieldHintText: "text-[11px] text-faint",
    formFieldInfoText: "text-[11px] text-faint",
    formFieldErrorText: "text-[12px] font-medium text-danger",
    formFieldSuccessText: "text-[12px] font-medium text-ok",
    formFieldWarningText: "text-[12px] font-medium text-warn",

    formButtonPrimary:
      "btn btn-primary btn-md w-full shadow-none normal-case tracking-normal text-[13px]",
    formButtonReset: "btn btn-ghost btn-md shadow-none normal-case tracking-normal",

    // One box per digit, matching the field rather than Clerk's own outline.
    otpCodeFieldInput: "field size-11 text-center text-[16px] font-semibold",
    formResendCodeLink: "text-[12px] font-medium text-accent hover:text-accent-ink",

    // --- who you are, mid-flow --------------------------------------------
    identityPreview: "rounded-xl bg-sunken ring-1 ring-line shadow-none",
    identityPreviewText: "text-[13px] text-ink",
    identityPreviewEditButton: "text-accent hover:text-accent-ink",

    // --- the bottom of the card -------------------------------------------
    // Clerk's footer carries its badge and, in development, its mode banner.
    // It stays, quietly: the badge is theirs to show.
    footer: "shadow-none border-0",
    footerAction: "bg-transparent",
    footerActionText: "text-[12px] text-muted",
    footerActionLink: "text-[12px] font-semibold text-accent hover:text-accent-ink",

    alertText: "text-[13px] text-ink",

    // --- the account panel -------------------------------------------------
    // A second component, with a nav rail and pages of its own. Only type and
    // colour are set here on purpose: its layout is Clerk's, it cannot be
    // photographed without a session, and fighting that layout is what
    // cropped this panel the last time somebody tried.
    navbarButtonText: "text-[13px] font-medium",
    profileSectionTitleText: "text-[14px] font-semibold tracking-tight text-ink",
    profileSectionSubtitleText: "text-[12px] text-muted",
    badge: "rounded-full bg-accent-soft text-accent-ink",
    menuItem: "text-[13px]",
  },
} as const;
