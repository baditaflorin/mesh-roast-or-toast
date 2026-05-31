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

/**
 * The advertised claim is three-part: "rapid fire/rose reactions; cumulative
 * leaderboard". The test above only proves the FIRE side and only reads the
 * `.roast-ratio` data attribute on the hot-seat page. This test exercises BOTH
 * reaction kinds (ROAST 🔥 + TOAST 🌹) and asserts the result on the
 * *cumulative leaderboard* as rendered on the OPPOSITE peer — the audience peer
 * who cast the votes. The leaderboard `sub` is `${fire}🔥 / ${rose}🌹` and the
 * score column is the fire count, so it proves rose taps actually cross the
 * mesh into the shared tally Y.Map AND that the cumulative board re-derives
 * from it on the other browser.
 */
test("ROAST + TOAST taps land in the cumulative leaderboard on the audience peer", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(800);

    await a.getByRole("button", { name: "start", exact: true }).click();
    await a.waitForTimeout(400);

    const hotSeatName = (await a.locator(".roast-current-name").innerText()).trim();
    const audience = hotSeatName === "alice" ? b : a;

    // Cast 2 roasts and 3 toasts from the audience at the peer in the hot seat.
    for (let i = 0; i < 2; i++) {
      await audience.getByRole("button", { name: "ROAST", exact: true }).click();
    }
    for (let i = 0; i < 3; i++) {
      await audience.getByRole("button", { name: "TOAST", exact: true }).click();
    }

    // Read the cumulative leaderboard on the audience (opposite) peer. The
    // hot-seat peer's row must show 2🔥 / 3🌹 — proving both reaction kinds
    // synced into the shared tally and the board re-derived from it.
    const hotSeatRow = audience
      .locator(".mesh-leaderboard-row")
      .filter({ has: audience.locator(".mesh-leaderboard-name", { hasText: hotSeatName }) });
    await expect(hotSeatRow.locator(".mesh-leaderboard-sub")).toHaveText("2🔥 / 3🌹");
    // The score column is the cumulative fire count.
    await expect(hotSeatRow.locator(".mesh-leaderboard-score")).toHaveText("2");
  } finally {
    await cleanup();
  }
});
