import { expect, test } from "@playwright/test";

test.describe("render firewall smoke", () => {
  test("landing route renders non-blank content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText(/Turn rough ideas into prompts that/i)).toBeVisible();

    const mainHeight = await page.locator("main").evaluate((node) => node.getBoundingClientRect().height);
    expect(mainHeight).toBeGreaterThan(260);
  });

  test("login route always renders auth card", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator(".auth-card")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("favicon links and assets resolve", async ({ page }) => {
    await page.goto("/");

    const iconHrefs = await page
      .locator('head link[rel~="icon"], head link[rel="shortcut icon"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLLinkElement).href));

    expect(iconHrefs.some((href) => href.includes("favicon.svg"))).toBeTruthy();
    expect(iconHrefs.some((href) => href.includes("favicon-32x32.png"))).toBeTruthy();
    expect(iconHrefs.some((href) => href.includes("favicon.ico"))).toBeTruthy();

    const responses = await Promise.all([
      page.request.get("/favicon.svg?v=4"),
      page.request.get("/favicon-32x32.png?v=4"),
      page.request.get("/favicon.ico?v=4"),
    ]);

    responses.forEach((response) => expect(response.ok()).toBeTruthy());
  });
});
