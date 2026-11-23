import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InboxSkeleton } from "./InboxSkeleton.tsx";
import { ProjectSwitcher, ProjectSwitcherSkeleton } from "./ProjectSwitcher.tsx";
import { ReportDetailSkeleton } from "./ReportDetailSkeleton.tsx";
import { Skeleton } from "./ui.tsx";

describe("Skeleton UI components", () => {
  it("renders base Skeleton element with pulse animation class", () => {
    const html = renderToStaticMarkup(<Skeleton className="h-4 w-12" />);
    assert.match(html, /animate-pulse/);
    assert.match(html, /h-4 w-12/);
  });

  describe("ProjectSwitcher skeleton", () => {
    it("renders pulsating skeleton placeholder via ProjectSwitcherSkeleton", () => {
      const html = renderToStaticMarkup(<ProjectSwitcherSkeleton />);
      assert.match(html, /data-testid="project-switcher-skeleton"/);
      assert.match(html, /animate-pulse/);
    });

    it("renders pulsating skeleton placeholder when ProjectSwitcher has loading=true", () => {
      const html = renderToStaticMarkup(
        <ProjectSwitcher projectName="Portfolio" loading={true} />
      );
      assert.match(html, /data-testid="project-switcher-skeleton"/);
      assert.match(html, /animate-pulse/);
      assert.doesNotMatch(html, /Portfolio/);
    });
  });

  describe("InboxSkeleton", () => {
    it("renders table header and default 7 rows", () => {
      const html = renderToStaticMarkup(<InboxSkeleton />);
      assert.match(html, /data-testid="inbox-skeleton"/);
      assert.match(html, />Report</);
      assert.match(html, />Reporters</);
      assert.match(html, />Status</);
      assert.match(html, />Age</);
      assert.doesNotMatch(html, />Repo</);

      // Verify row count by counting aria-hidden items
      const rows = html.match(/aria-hidden="true"/g);
      assert.equal(rows?.length, 7);
    });

    it("renders custom number of rows and repo column when hasRepos is true", () => {
      const html = renderToStaticMarkup(<InboxSkeleton rows={4} hasRepos={true} />);
      assert.match(html, />Repo</);
      const rows = html.match(/aria-hidden="true"/g);
      assert.equal(rows?.length, 4);
    });
  });

  describe("ReportDetailSkeleton", () => {
    it("renders layout skeleton container with detail testid", () => {
      const html = renderToStaticMarkup(<ReportDetailSkeleton />);
      assert.match(html, /data-testid="report-detail-skeleton"/);
      assert.match(html, /animate-pulse/);
    });
  });
});
