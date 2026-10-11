import { describe, expect, it } from "vitest";
import { browserHost, gitlabNeedsCanonicalHost } from "@/routes/api_.auth.$";

const req = (headers: Record<string, string>) => new Request("https://internal.vercel.app/api/auth/link-social", { headers });

describe("GitLab host check", () => {
  it("uses the browser Origin over a proxy host", () => {
    const h = browserHost(req({ origin: "https://rout.be", "x-forwarded-host": "rout-abc.vercel.app" }));
    expect(h).toBe("rout.be");
    expect(gitlabNeedsCanonicalHost(h, "rout.be")).toBe(false);
  });
  it("sends other hosts to the canonical one", () => {
    expect(gitlabNeedsCanonicalHost(browserHost(req({ origin: "https://www.rout.be" })), "rout.be")).toBe(true);
  });
  it("never redirects localhost", () => {
    expect(gitlabNeedsCanonicalHost("localhost:8080", "rout.be")).toBe(false);
  });
});
