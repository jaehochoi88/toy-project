import { expect, test } from "@playwright/test";

test("홈 화면은 로그인하지 않은 사용자를 로그인 화면으로 보낸다", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("특허 아이디어 도구");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in" })
  ).toBeVisible();
});
