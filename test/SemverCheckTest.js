import test from "node:test";
import semver from "semver";

test("Satisfies sanity checks with beta/canary", (t) => {
  t.assert.strictEqual(semver.satisfies("1.0.0-beta.1", ">= 0.7.0", {
      includePrerelease: true,
    }), true, "1.0 Beta is valid for 0.x");

  t.assert.strictEqual(semver.satisfies("1.0.0-canary.1", ">= 0.7.0", {
      includePrerelease: true,
    }), true, "1.0 Canary is valid for 0.x");

  t.assert.strictEqual(semver.satisfies("1.0.0-beta.1", ">= 0.7.0", {
      includePrerelease: true,
    }), true, "1.0 Beta is valid for 0.x");

  t.assert.strictEqual(semver.satisfies("1.0.0", ">= 0.7.0", {
      includePrerelease: true,
    }), true, "1.0 is valid for 0.x");

  // keep canary around, it won’t have the `includePrerelease` option in `UserConfig->versionCheck`
  t.assert.strictEqual(semver.satisfies("1.0.0", ">=0.7 || >=1.0.0-canary", {
      includePrerelease: true,
    }), true);
  t.assert.strictEqual(semver.satisfies("1.0.0-beta.1", ">=0.7 || >=1.0.0-canary", {
      includePrerelease: true,
    }), true);
  t.assert.strictEqual(semver.satisfies("1.0.0-canary.1", ">=0.7 || >=1.0.0-canary", {
      includePrerelease: true,
    }), true);
});
