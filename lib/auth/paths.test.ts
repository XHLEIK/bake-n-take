import { describe, expect, it } from "vitest";

import {
  CUSTOMER_HOME,
  OWNER_HOME,
  WEBSTORE_HOME,
  destinationForRole,
  isLocalPath,
  isProtectedPath,
  loginPathFor,
  pathWithParams,
  safeNextPath,
} from "./paths";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_AREA = `/webstore/${CUSTOMER_ID}`;
const OWNER_AREA = `/owner/${OWNER_ID}`;

describe("safeNextPath", () => {
  it("keeps a plain local path", () => {
    expect(safeNextPath("/customer", "/")).toBe("/customer");
    expect(safeNextPath("/customer?tab=orders", "/")).toBe("/customer?tab=orders");
  });

  it("falls back for protocol-relative and absolute URLs", () => {
    expect(safeNextPath("//evil.example.com", "/fallback")).toBe("/fallback");
    expect(safeNextPath("https://evil.example.com/steal", "/fallback")).toBe("/fallback");
    expect(safeNextPath("http://evil.example.com", "/fallback")).toBe("/fallback");
    expect(safeNextPath("javascript:alert(1)", "/fallback")).toBe("/fallback");
  });

  it("falls back for encoded and backslash variants", () => {
    expect(safeNextPath("%2F%2Fevil.example.com", "/fallback")).toBe("/fallback");
    expect(safeNextPath("/\\evil.example.com", "/fallback")).toBe("/fallback");
    expect(safeNextPath("/customer\\..\\owner", "/fallback")).toBe("/fallback");
  });

  it("rejects control characters and over-long values", () => {
    expect(safeNextPath("/customer\r\nSet-Cookie: x=1", "/fallback")).toBe("/fallback");
    expect(safeNextPath("/customer\u0000", "/fallback")).toBe("/fallback");
    expect(safeNextPath(`/${"a".repeat(600)}`, "/fallback")).toBe("/fallback");
  });

  it("rejects malformed percent-encoding and non-strings", () => {
    expect(safeNextPath("%", "/fallback")).toBe("/fallback");
    expect(safeNextPath(undefined, "/fallback")).toBe("/fallback");
    expect(safeNextPath(["//evil.example.com", "/customer"], "/fallback")).toBe("/fallback");
    expect(safeNextPath(["/customer", "/owner"], "/fallback")).toBe("/customer");
  });

  it("trims surrounding whitespace", () => {
    expect(safeNextPath("  /customer  ", "/fallback")).toBe("/customer");
  });
});

describe("isLocalPath", () => {
  it("accepts only same-origin absolute paths", () => {
    expect(isLocalPath("/")).toBe(true);
    expect(isLocalPath("/a/b")).toBe(true);
    expect(isLocalPath("")).toBe(false);
    expect(isLocalPath("a/b")).toBe(false);
    expect(isLocalPath("//host")).toBe(false);
  });
});

describe("isProtectedPath", () => {
  it("protects customer and owner areas", () => {
    expect(isProtectedPath(CUSTOMER_HOME)).toBe(true);
    expect(isProtectedPath("/customer/orders")).toBe(true);
    expect(isProtectedPath(OWNER_HOME)).toBe(true);
    expect(isProtectedPath("/owner/products")).toBe(true);
    expect(isProtectedPath(WEBSTORE_HOME)).toBe(true);
    expect(isProtectedPath(`/webstore/${CUSTOMER_ID}`)).toBe(true);
    expect(isProtectedPath(`/owner/${OWNER_ID}`)).toBe(true);
  });

  it("keeps public routes public", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/signup")).toBe(false);
    expect(isProtectedPath("/forgot-password")).toBe(false);
    expect(isProtectedPath("/update-password")).toBe(false);
    expect(isProtectedPath("/owner/login")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
  });
});

describe("loginPathFor", () => {
  it("sends owner routes to the staff entrance", () => {
    expect(loginPathFor("/owner")).toBe("/owner/login");
    expect(loginPathFor("/owner/products")).toBe("/owner/login");
    expect(loginPathFor(`/owner/${OWNER_ID}`)).toBe("/owner/login");
    expect(loginPathFor("/customer")).toBe("/login");
    expect(loginPathFor(CUSTOMER_AREA)).toBe("/login");
    expect(loginPathFor("/")).toBe("/login");
  });
});

describe("destinationForRole", () => {
  it("uses the role home when there is no hint", () => {
    expect(destinationForRole("CUSTOMER", undefined, CUSTOMER_ID)).toBe(CUSTOMER_AREA);
    expect(destinationForRole("OWNER", undefined, OWNER_ID)).toBe(OWNER_AREA);
  });

  it("honours a safe hint inside the caller's own area", () => {
    expect(destinationForRole("CUSTOMER", "/customer/orders", CUSTOMER_ID)).toBe(
      "/customer/orders",
    );
    expect(destinationForRole("CUSTOMER", CUSTOMER_AREA, CUSTOMER_ID)).toBe(CUSTOMER_AREA);
    expect(destinationForRole("OWNER", "/owner/products", OWNER_ID)).toBe("/owner/products");
  });

  it("refuses a hint that crosses areas", () => {
    expect(destinationForRole("CUSTOMER", "/owner", CUSTOMER_ID)).toBe(CUSTOMER_AREA);
    expect(destinationForRole("OWNER", "/customer", OWNER_ID)).toBe(OWNER_AREA);
  });

  it("refuses hints outside protected areas or off-site", () => {
    expect(destinationForRole("CUSTOMER", "/", CUSTOMER_ID)).toBe(CUSTOMER_AREA);
    expect(destinationForRole("CUSTOMER", "https://evil.example.com", CUSTOMER_ID)).toBe(
      CUSTOMER_AREA,
    );
    expect(destinationForRole("OWNER", "//evil.example.com", OWNER_ID)).toBe(OWNER_AREA);
  });
});

describe("pathWithParams", () => {
  it("appends only non-empty values", () => {
    expect(pathWithParams("/login", { next: "/customer", error: undefined })).toBe(
      "/login?next=%2Fcustomer",
    );
    expect(pathWithParams("/login", {})).toBe("/login");
    expect(pathWithParams("/login", { error: null, notice: "" })).toBe("/login");
  });
});
