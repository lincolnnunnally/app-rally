import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCTION_ORIGINS,
  rallyAllowedHosts,
  rallyTrustedOrigins,
} from "./trusted-hosts.ts";

const leftoverUnique = "https://app-rally-mjyyyhwx4-life-produces-life.vercel.app";
const leftoverBranch =
  "https://app-rally-git-cursor-coach-pay-handles-3901-life-produces-life.vercel.app";
const live = "https://rally.unitedundergod.org";

/** Same class as Better Auth: host wildcard `*.vercel.app` vs Origin host. */
function matchesHostWildcard(origin: string, pattern: string) {
  const host = new URL(origin).host;
  if (pattern === host || pattern === origin) return true;
  if (pattern.startsWith("https://") || pattern.startsWith("http://")) {
    const star = pattern.replace(/^https?:\/\//, "");
    return star.startsWith("*.") && host.endsWith(star.slice(1));
  }
  return pattern.startsWith("*.") && host.endsWith(pattern.slice(1));
}

describe("rallyTrustedOrigins", () => {
  it("allows unique *.vercel.app previews even when BETTER_AUTH_URL is production", () => {
    const origins = rallyTrustedOrigins({
      explicitBaseURL: live,
      previewHosts: ["*.grok-sandbox.com"],
    });
    assert.ok(origins.includes(live), "production custom domain stays trusted");
    assert.ok(
      origins.some((o) => matchesHostWildcard(leftoverUnique, o)),
      `leftover unique ${leftoverUnique} must match a trusted pattern`,
    );
    assert.ok(
      origins.some((o) => matchesHostWildcard(leftoverBranch, o)),
      `leftover branch alias ${leftoverBranch} must match a trusted pattern`,
    );
  });

  it("keeps production origins on the list without BETTER_AUTH_URL", () => {
    const origins = rallyTrustedOrigins({ previewHosts: ["*.grok-sandbox.com"] });
    for (const origin of PRODUCTION_ORIGINS) {
      assert.ok(origins.includes(origin), origin);
    }
  });
});

describe("rallyAllowedHosts", () => {
  it("includes production host and vercel preview wildcard", () => {
    const hosts = rallyAllowedHosts(["*.grok-sandbox.com"]);
    assert.ok(hosts.includes("rally.unitedundergod.org"));
    assert.ok(hosts.includes("*.vercel.app"));
  });
});
