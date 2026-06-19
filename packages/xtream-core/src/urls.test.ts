import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlayerApiUrl,
  buildStreamUrl,
  normalizeServerUrl,
  validateCredentials,
} from "./urls.js";

describe("normalizeServerUrl", () => {
  it("adds http when scheme missing", () => {
    assert.equal(normalizeServerUrl("example.com:8080"), "http://example.com:8080");
  });

  it("strips trailing slashes", () => {
    assert.equal(normalizeServerUrl("http://example.com/"), "http://example.com");
  });
});

describe("buildPlayerApiUrl", () => {
  it("builds auth url", () => {
    const url = buildPlayerApiUrl({
      serverUrl: "http://example.com:8080",
      username: "user",
      password: "pass",
    });
    assert.match(url, /player_api\.php\?username=user&password=pass$/);
  });

  it("builds action url", () => {
    const url = buildPlayerApiUrl(
      { serverUrl: "http://example.com", username: "u", password: "p" },
      "get_live_categories",
    );
    assert.match(url, /action=get_live_categories/);
  });
});

describe("buildStreamUrl", () => {
  it("builds live url", () => {
    const url = buildStreamUrl(
      { serverUrl: "http://example.com", username: "u", password: "p" },
      "live",
      1001,
    );
    assert.equal(url, "http://example.com/live/u/p/1001.ts");
  });

  it("builds movie url with extension", () => {
    const url = buildStreamUrl(
      { serverUrl: "http://example.com", username: "u", password: "p" },
      "movie",
      55,
      "mkv",
    );
    assert.equal(url, "http://example.com/movie/u/p/55.mkv");
  });
});

describe("validateCredentials", () => {
  it("returns errors for empty fields", () => {
    const errors = validateCredentials({ serverUrl: "", username: "", password: "" });
    assert.equal(errors.length, 3);
  });
});
