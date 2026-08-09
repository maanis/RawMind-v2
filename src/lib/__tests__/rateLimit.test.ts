import { checkRateLimit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  it("allows requests under the limit and blocks over limit", async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    await expect(checkRateLimit(key, 2, 60_000)).resolves.toBe(true);
    await expect(checkRateLimit(key, 2, 60_000)).resolves.toBe(true);
    await expect(checkRateLimit(key, 2, 60_000)).resolves.toBe(false);
  });
});
