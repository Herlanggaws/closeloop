export const LANDING_FAQ_ITEMS = [
  {
    question: "How long does it take to install?",
    answer:
      "One script tag or npm package for web; one dependency for Android, iOS, Flutter or React Native. Most builders see their first report in under five minutes.",
  },
  {
    question: "What happens to private data in screenshots?",
    answer:
      "Sensitive inputs and elements you mark are masked on the client before screenshot or replay upload. You control what gets blurred.",
  },
  {
    question: "What if I go over my report quota?",
    answer:
      "Reports keep coming in — they soft-block so new ones stay unreadable until you upgrade or the month resets. Your data is kept.",
  },
  {
    question: "Can the AI merge code on its own?",
    answer:
      "No. Agents can open a PR; Saidloop never merges for you. You review and ship.",
  },
  {
    question: "Can I self-host Saidloop?",
    answer:
      "Yes on Business — Docker or Helm with an annual license. Cloud plans remain the default for everyone else.",
  },
] as const;
