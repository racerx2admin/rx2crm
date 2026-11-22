import { describe, expect, it } from "vitest";
import { domainOf, isDuplicate, nameKey, remember } from "../lib/dedupe";

describe("dedupe", () => {
  it("normalizes domains", () => {
    expect(domainOf("https://www.IntegralFab.com/about")).toBe("integralfab.com");
    expect(domainOf("integralfab.com")).toBe("integralfab.com");
    expect(domainOf("not a url")).toBeNull();
    expect(domainOf(null)).toBeNull();
  });
  it("cleans company names", () => {
    expect(nameKey("The Gill Corporation, Inc.")).toBe("gill");
    expect(nameKey("Integral Engineering & Fabrication LLC")).toBe("integral engineering and fabrication");
    expect(nameKey("RPM Offroad Garage")).toBe(nameKey("rpm offroad garage, inc"));
  });
  it("catches duplicates by domain or name", () => {
    const known = { domains: new Set<string>(), names: new Set<string>() };
    remember(known, "Vacco Industries", "https://www.vacco.com");
    expect(isDuplicate(known, "VACCO", "vacco.com/contact")).toBe(true);
    expect(isDuplicate(known, "Vacco Industries Inc", "https://other.com")).toBe(true);
    expect(isDuplicate(known, "Dow Hydraulics", "dowhydraulics.com")).toBe(false);
  });
});
