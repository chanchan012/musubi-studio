import { describe, expect, it } from "vitest";
import { roleAtLeast } from "@/lib/acl";

describe("roleAtLeast", () => {
  it("orders owner > editor > viewer", () => {
    expect(roleAtLeast("owner", "editor")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast("editor", "owner")).toBe(false);
  });
  it("never passes without a role", () => {
    expect(roleAtLeast(null, "viewer")).toBe(false);
    expect(roleAtLeast(undefined, "viewer")).toBe(false);
  });
});
