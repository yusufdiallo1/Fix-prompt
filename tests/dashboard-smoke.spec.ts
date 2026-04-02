import { expect, test } from "@playwright/test";

const smokeEmail = process.env.SMOKE_USER_EMAIL;
const smokePassword = process.env.SMOKE_USER_PASSWORD;
const testRunner = smokeEmail && smokePassword ? test : test.skip;

test.describe("dashboard smoke", () => {
  testRunner("dashboard is non-empty after auth", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(smokeEmail!);
    await page.locator('input[type="password"]').fill(smokePassword!);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Recent Sessions/i })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();

    const mainText = await page.locator("main").innerText();
    expect(mainText.trim().length).toBeGreaterThan(80);
  });
});
