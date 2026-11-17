export type MarketingLink = {
  label: string;
  href: string;
};

export type MarketingColumn = {
  title: string;
  links: MarketingLink[];
};

export const MARKETING_FOOTER_COLUMNS: MarketingColumn[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Platforms", href: "/#platforms" },
      { label: "MCP server", href: "/#mcp" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Web widget", href: "/docs/web-widget" },
      { label: "Android SDK", href: "/docs/android" },
      { label: "iOS SDK", href: "/docs/ios" },
      { label: "Flutter & React Native", href: "/docs/mobile" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/privacy" },
      { label: "DPA", href: "/dpa" },
      { label: "Terms", href: "/terms" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const CONTACT_EMAIL = "business@xerv-project.id";
export const PRODUCT_DOMAIN = "saidloop.com";
export const LEGAL_LAST_UPDATED = "November 17, 2026";
