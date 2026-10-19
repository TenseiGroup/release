const { existsSync, readFileSync } = require("node:fs");
const { sync } = require("node:child_process");

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

addPlugin("@semantic-release/release-notes-generator", {
  preset: "conventionalcommits",
  parserOpts: { noteKeywords },
  writerOpts: {
    commitsSort: ["scope", "subject"],
  },
  presetConfig: {
    types: [
      { type: "feat", section: "Features" },
      { type: "feature", section: "Features" },
      { type: "fix", section: "Bug Fixes" },
      { type: "perf", section: "Performance Improvements" },
      { type: "revert", section: "Reverts" },
      { type: "docs", section: "Documentation" },
      { type: "style", section: "Styles" },
      { type: "refactor", section: "Code Refactoring" },
      { type: "test", section: "Tests" },
      { type: "build", section: "Build System" },
      { type: "ci", section: "Continuous Integration" },
    ],
  },
});

// Changelog is titled from the consuming package when resolvable.
let changelogTitle = "# Changelog";
try {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (pkg.name) {
    changelogTitle = `# ${pkg.name} changelog

> All notable changes to this project will be documented in this file`;
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
  message:
    "chore(<%= nextRelease.type %>): release <%= nextRelease.version %>" +
    "<%= nextRelease.channel !== null ? ` on ${nextRelease.channel} channel` : '' %> [skip ci]\n\n" +
    "<%= nextRelease.notes %>",
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
