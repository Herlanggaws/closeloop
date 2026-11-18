export type TourSide = "above" | "below" | "left" | "right";

export type TourStep = {
  target: string;
  side: TourSide;
  tag: string;
  title: string;
  body: string;
};

export type TourDefinition = {
  id: string;
  routes: string[];
  /** When set, this tour only starts after the listed tour is seen (or skipped). */
  after?: string;
  steps: TourStep[];
};

export type TourFooterKind = "first" | "middle" | "last" | "single";

export type TourFooterLabels = {
  kind: TourFooterKind;
  counter: string | null;
  secondary: string;
  primary: string;
  showArrow: boolean;
};

export const TOURS: Record<string, TourDefinition> = {
  project: {
    id: "project",
    routes: ["/app/settings"],
    steps: [
      {
        target: "project-keys",
        side: "below",
        tag: "PROJECT KEYS",
        title: "Two keys, two jobs",
        body: "The public key ships in your app and can only create reports. MCP tokens let your AI agent read and close them. Copy a new token now, it's shown once.",
      },
      {
        target: "project-masking",
        side: "below",
        tag: "PROJECT SETTINGS",
        title: "Blur sensitive data at the source",
        body: "Mask all text inputs, or add your own selectors. Masked content is blurred on the device and never reaches our servers.",
      },
      {
        target: "project-widget",
        side: "below",
        tag: "PROJECT SETTINGS",
        title: "Make the Report button yours",
        body: "Set the button label, position and accent color so it fits your app. Custom branding comes with Studio.",
      },
    ],
  },
  install: {
    id: "install",
    routes: ["/app/install", "/app/onboarding/install"],
    steps: [
      {
        target: "install-script",
        side: "below",
        tag: "WEB WIDGET",
        title: "Paste one line and you're live",
        body: "Add this script before </body>. Your first report shows up in the panel on the right, usually within 5 minutes.",
      },
      {
        target: "install-mask",
        side: "below",
        tag: "WEB WIDGET",
        title: "Mark what stays private",
        body: "Add data-closeloop-mask to balances, card numbers or anything personal. It's blurred on the device before the screenshot leaves it.",
      },
      {
        target: "install-first-report",
        side: "below",
        tag: "WEB WIDGET",
        title: "Send a test report",
        body: "Open your app and report something. It lands here with browser, version and user, so you can see the setup worked.",
      },
    ],
  },
  mobile: {
    id: "mobile",
    routes: ["/app/onboarding"],
    steps: [
      {
        target: "platform-native",
        side: "right",
        tag: "MOBILE SDK",
        title: "Shake to report on Android and iOS",
        body: "Kotlin on Maven Central, Swift Package on iOS. Users shake their phone to report. Screenshot, device and app version come along, and offline reports resend later.",
      },
    ],
  },
  "cross-platform": {
    id: "cross-platform",
    routes: ["/app/onboarding"],
    after: "mobile",
    steps: [
      {
        target: "platform-cross",
        side: "below",
        tag: "FLUTTER & RN",
        title: "No native code needed",
        body: "The Flutter and React Native packages wrap the same Android and iOS SDKs. Same API, same masking and offline queue. Expo works too.",
      },
    ],
  },
  inbox: {
    id: "inbox",
    routes: ["/app/inbox"],
    steps: [
      {
        target: "inbox-filters",
        side: "below",
        tag: "INBOX",
        title: "Every report lands here",
        body: "Bugs, ideas and questions from every platform, with screenshot and context attached. Filter by type, status or platform.",
      },
      {
        target: "inbox-row",
        side: "below",
        tag: "INBOX",
        title: "Open a report for the full story",
        body: "Each report carries the screenshot, device, app version and user. Similar reports are flagged so you can merge them.",
      },
      {
        target: "inbox-bulk",
        side: "above",
        tag: "INBOX",
        title: "Act on many at once",
        body: "Select reports to merge duplicates into one ticket or change their status together. Every reporter stays attached.",
      },
    ],
  },
  mcp: {
    id: "mcp",
    routes: ["/app/mcp", "/app/onboarding/mcp"],
    steps: [
      {
        target: "mcp-token",
        side: "below",
        tag: "MCP",
        title: "Create a token for your agent",
        body: "Each agent gets its own token, shown once. Name it after the machine so you can revoke it later.",
      },
      {
        target: "mcp-command",
        side: "below",
        tag: "MCP",
        title: "Let your agent read the inbox",
        body: "Run this once in Claude Code, or paste it into .cursor/mcp.json. Then ask your agent to fix the open bugs. It reads each report and marks it fixed when done.",
      },
      {
        target: "mcp-test",
        side: "above",
        tag: "MCP",
        title: "Check the connection",
        body: "Ask your agent to list open feedback. When it answers, this step turns green and you're done.",
      },
    ],
  },
  notify: {
    id: "notify",
    routes: ["/app/tickets"],
    steps: [
      {
        target: "notify-note",
        side: "right",
        tag: "NOTIFY REPORTERS",
        title: "Add a short note",
        body: "Say what changed in one sentence. It's optional, but reporters like hearing it from you.",
      },
      {
        target: "notify-channels",
        side: "right",
        tag: "NOTIFY REPORTERS",
        title: "Tell them it's fixed",
        body: "Everyone who reported this gets your note by email and as a banner the next time they open your app. This is the step most feedback tools skip.",
      },
      {
        target: "notify-preview",
        side: "right",
        tag: "NOTIFY REPORTERS",
        title: "Check it before you send",
        body: "This is the banner reporters see the next time they open your app. The email carries the same note.",
      },
    ],
  },
  integrations: {
    id: "integrations",
    routes: ["/app/settings/integrations"],
    steps: [
      {
        target: "integrations-track",
        side: "below",
        tag: "INTEGRATIONS",
        title: "Send reports where you already work",
        body: "Post new reports to Slack, or push them to GitHub Issues, Linear or Jira. Close the issue there and Saidloop marks the ticket fixed and tells the reporter.",
      },
      {
        target: "integrations-debug",
        side: "below",
        tag: "INTEGRATIONS",
        title: "Add debugging context",
        body: "Connect Sentry and PostHog and each report links to the matching error and session. Your agent gets them through MCP too.",
      },
      {
        target: "integrations-slack",
        side: "below",
        tag: "INTEGRATIONS",
        title: "Pick what gets posted",
        body: "Choose which events reach #feedback: new bugs, new ideas, status changes or fixes.",
      },
    ],
  },
  board: {
    id: "board",
    routes: ["/app/board"],
    steps: [
      {
        target: "board-row",
        side: "below",
        tag: "PUBLIC BOARD",
        title: "You choose what's public",
        body: "Only ideas you switch on appear on your board. Bugs and personal data stay private. Voters get an email when the idea ships.",
      },
      {
        target: "board-tabs",
        side: "below",
        tag: "PUBLIC BOARD",
        title: "Roadmap and comments live here",
        body: "Move ideas onto the roadmap so voters can follow them. New comments wait in the Comments tab until you approve them.",
      },
      {
        target: "board-view",
        side: "below",
        tag: "PUBLIC BOARD",
        title: "See it as your users do",
        body: "Open the public board on its own page. Share the link in your app or changelog.",
      },
    ],
  },
  "auto-pr": {
    id: "auto-pr",
    routes: ["/app/auto-pr"],
    steps: [
      {
        target: "autopr-repo",
        side: "left",
        tag: "AUTO PR",
        title: "Connect a repo first",
        body: "The GitHub App can read code and open branches and PRs. It can never merge.",
      },
      {
        target: "autopr-rules",
        side: "left",
        tag: "AUTO PR",
        title: "Let AI open the pull request",
        body: "Pick a label and new bugs with it get a fix PR from an agent in a sandbox. It never merges, you review and merge. One run uses one credit.",
      },
      {
        target: "autopr-runs",
        side: "below",
        tag: "AUTO PR",
        title: "Every run, on the record",
        body: "See each run's status, the PR it opened and the credits it used. Open a run to read the agent's log.",
      },
    ],
  },
  replay: {
    id: "replay",
    routes: ["/app/tickets"],
    steps: [
      {
        target: "ticket-replay-tab",
        side: "above",
        tag: "SESSION REPLAY",
        title: "See what happened before the report",
        body: "Watch the last few minutes before the user hit send. Text inputs and fields you mark sensitive are masked in their browser first.",
      },
    ],
  },
  sso: {
    id: "sso",
    routes: ["/app/settings/sso"],
    steps: [
      {
        target: "sso-config",
        side: "below",
        tag: "SSO & AUDIT",
        title: "Lock it down for your team",
        body: "Connect SAML or OIDC, verify your domain, then enforce SSO. Every login, role change, export and MCP action lands in the audit log below.",
      },
      {
        target: "sso-domains",
        side: "below",
        tag: "SSO & AUDIT",
        title: "Verify your domain",
        body: "Add a DNS TXT record. Once it's verified, anyone signing in with that domain goes through your SSO.",
      },
      {
        target: "sso-audit",
        side: "above",
        tag: "SSO & AUDIT",
        title: "Every action, on record",
        body: "Logins, role changes, exports, MCP calls and auto PR runs. Filter the log or export it.",
      },
    ],
  },
  "self-host": {
    id: "self-host",
    routes: ["/app/settings/self-host"],
    steps: [
      {
        target: "selfhost-key",
        side: "right",
        tag: "SELF-HOST",
        title: "Paste your license key",
        body: "Use the annual license key from your Business plan to activate this instance.",
      },
      {
        target: "selfhost-info",
        side: "right",
        tag: "SELF-HOST",
        title: "Check seats and version",
        body: "See who it's licensed to, how many seats are in use and whether a newer release is out.",
      },
      {
        target: "selfhost-update",
        side: "right",
        tag: "SELF-HOST",
        title: "Update with one command",
        body: "Pull the latest image and restart. Your data stays in your own Postgres and S3 storage.",
      },
    ],
  },
};

export function getTour(tourId: string): TourDefinition | undefined {
  return TOURS[tourId];
}

export function tourFooterLabels(stepIndex: number, stepCount: number): TourFooterLabels {
  if (stepCount <= 1) {
    return {
      kind: "single",
      counter: null,
      secondary: "Turn off tips",
      primary: "Got it",
      showArrow: false,
    };
  }
  if (stepIndex <= 0) {
    return {
      kind: "first",
      counter: `1 of ${stepCount}`,
      secondary: "Skip tour",
      primary: "Next",
      showArrow: true,
    };
  }
  if (stepIndex >= stepCount - 1) {
    return {
      kind: "last",
      counter: null,
      secondary: "Back",
      primary: "Done",
      showArrow: false,
    };
  }
  return {
    kind: "middle",
    counter: null,
    secondary: "Back",
    primary: "Next",
    showArrow: true,
  };
}

export function resolveTourTarget(target: string): Element | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(`[data-tour="${target}"]`);
}

/** Keep steps whose targets exist in the DOM right now. */
export function availableTourSteps(steps: TourStep[]): TourStep[] {
  return steps.filter((step) => resolveTourTarget(step.target) != null);
}

export function canStartTour(
  tour: TourDefinition,
  opts: { userId: string; isSeen: (id: string) => boolean; isDisabled: boolean },
): boolean {
  if (opts.isDisabled) return false;
  if (opts.isSeen(tour.id)) return false;
  if (tour.after && !opts.isSeen(tour.after)) return false;
  return availableTourSteps(tour.steps).length > 0;
}
