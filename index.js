const { existsSync, readFileSync } = require("node:fs");
const { sync } = require("node:child_process");
const { dirname, join } = require("node:path");

const plugins = [];
const noteKeywords = ["BREAKING CHANGE", "BREAKING CHANGES", "BREAKING"];

const { GITHUB_SHA, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL } = process.env;

const successCmd = `
echo "RELEASE_TAG=v\${nextRelease.version}" >> "$GITHUB_ENV"
echo "RELEASE_VERSION=\${nextRelease.version}" >> "$GITHUB_ENV"
`;

const addPlugin = (plugin, options) => plugins.push([plugin, options]);

// Fallback release identity when the CI user is anonymous.
if (!GIT_COMMITTER_NAME) {
  process.env.GIT_COMMITTER_NAME = "tensei-group[bot]";
  process.env.GIT_COMMITTER_EMAIL = "release@tensei.group";
}

// Reuse the triggering commit's author so the release commit is attributable.
if (GITHUB_SHA) {
  try {
    const authorName = sync(`git log -1 --pretty=format:%an ${GITHUB_SHA}`)
      .stdout.toString();
    const authorEmail = sync(`git log -1 --pretty=format:%ae ${GITHUB_SHA}`)
      .stdout.toString();
    if (authorName && !GIT_AUTHOR_NAME) {
      process.env.GIT_AUTHOR_NAME = authorName;
    }
    if (authorEmail && !GIT_AUTHOR_EMAIL) {
      process.env.GIT_AUTHOR_EMAIL = authorEmail;
    }
  } catch {
    // Non-fatal: semantic-release falls back to the committer identity above.
  }
}

// Pre-1.0 discipline: breaking changes and feats both bump the 0.x minor,
// fixes bump patch, chores/docs/ci/test/style never release on their own.
addPlugin("@semantic-release/commit-analyzer", {
  preset: "conventionalcommits",
  releaseRules: [
    { breaking: true, release: "minor" },
    { type: "feat", release: "minor" },
    { type: "fix", release: "patch" },
    { type: "perf", release: "patch" },
    { type: "revert", release: "patch" },
    { type: "refactor", release: "patch" },
    { type: "docs", release: false },
    { type: "style", release: false },
    { type: "test", release: false },
    { type: "build", release: false },
    { type: "ci", release: false },
    { type: "chore", release: false },
  ],
  parserOpts: { noteKeywords },
});

// The conventionalcommits main template never renders the footer partial,
// so append the footer slot to it and sign each entry quietly.
const presetDir = join(dirname(require.resolve("conventional-changelog-conventionalcommits")), "..");
const mainTemplate =
  readFileSync(join(presetDir, "src/templates/template.hbs"), "utf8") +
  "\n{{> footer}}\n";

addPlugin("@semantic-release/release-notes-generator", {
  preset: "conventionalcommits",
  parserOpts: { noteKeywords },
  writerOpts: {
    commitsSort: ["scope", "subject"],
    mainTemplate,
    footerPartial: "\n— 転生\n",
  },
  presetConfig: {
    types: [
      { type: "feat", section: "New" },
      { type: "feature", section: "New" },
      { type: "fix", section: "Fixes" },
      { type: "perf", section: "Performance" },
      { type: "revert", section: "Reverts" },
      { type: "refactor", section: "Refactoring" },
      { type: "docs", section: "Docs", hidden: true },
      { type: "style", section: "Styles", hidden: true },
      { type: "test", section: "Tests", hidden: true },
      { type: "build", section: "Build System", hidden: true },
      { type: "ci", section: "Continuous Integration", hidden: true },
      { type: "chore", section: "Chores", hidden: true },
    ],
  },
});

// Changelog is titled from the consuming package when resolvable.
let changelogTitle = "# Changelog";
try {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (pkg.name) {
    changelogTitle = `# ${pkg.name} changelog

> Each release is a small transformation. Taking what exists and giving it a new life.

All notable changes to this project will be documented in this file`;
  }
} catch {
  // Keep the default title.
}

addPlugin("@semantic-release/changelog", { changelogTitle });

// Version bump only: Tensei Group projects are applications, not npm packages.
addPlugin("@semantic-release/npm", { npmPublish: false });

const gitAssets = ["CHANGELOG.md", "package.json"];
if (existsSync("package-lock.json")) gitAssets.push("package-lock.json");
if (existsSync("bun.lock")) gitAssets.push("bun.lock");

addPlugin("@semantic-release/git", {
  assets: gitAssets,
  message: "chore(release): v<%= nextRelease.version %> [skip ci]",
});

addPlugin("@semantic-release/github", {
  addReleases: "bottom",
});

if (process.env.GITHUB_ACTIONS !== undefined) {
  addPlugin("@semantic-release/exec", { successCmd });
}

module.exports = {
  branches: [
    "main",
    { name: "beta", prerelease: true },
    { name: "alpha", prerelease: true },
  ],
  plugins,
};
