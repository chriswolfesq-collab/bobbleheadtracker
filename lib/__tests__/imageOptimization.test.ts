import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isUnoptimizedImage } from "@/lib/imageOptimization";

describe("isUnoptimizedImage", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  });

  it("optimizes local/relative assets", () => {
    expect(isUnoptimizedImage("/bobbleheads/dodgers.png")).toBe(false);
  });

  it("treats missing/empty src as local (optimized)", () => {
    expect(isUnoptimizedImage(null)).toBe(false);
    expect(isUnoptimizedImage(undefined)).toBe(false);
    expect(isUnoptimizedImage("")).toBe(false);
  });

  it("optimizes the trusted MLB CDN", () => {
    expect(isUnoptimizedImage("https://img.mlbstatic.com/mlb-photos/image.jpg")).toBe(false);
  });

  it("optimizes our own Supabase storage host", () => {
    expect(
      isUnoptimizedImage("https://abc123.supabase.co/storage/v1/object/public/x.jpg"),
    ).toBe(false);
  });

  it("does NOT optimize untrusted scrape hosts", () => {
    expect(isUnoptimizedImage("https://pbs.twimg.com/media/x.jpg")).toBe(true);
    expect(isUnoptimizedImage("https://i.ebayimg.com/images/x.jpg")).toBe(true);
    expect(isUnoptimizedImage("https://preview.redd.it/x.jpg")).toBe(true);
  });

  it("does not optimize a malformed URL", () => {
    expect(isUnoptimizedImage("http://")).toBe(true);
  });
});
