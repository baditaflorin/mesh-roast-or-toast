import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("audience ROAST taps register on hot-seat peer's page", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(800);

    await a.getByRole("button", { name: "start", exact: true }).click();
    await a.waitForTimeout(400);

    const hotSeat = (await a.locator(".roast-current-name").innerText()).trim();
    const audience = hotSeat === "alice" ? b : a;
    const seatPage = hotSeat === "alice" ? a : b;

    for (let i = 0; i < 3; i++) {
      await audience.getByRole("button", { name: "ROAST", exact: true }).click();
    }
    await seatPage.waitForTimeout(400);

    await expect(seatPage.locator(".roast-ratio")).toHaveAttribute("data-fire", "3");
  } finally {
    await cleanup();
  }
});
