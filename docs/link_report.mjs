#!/usr/bin/env node
// Render linkinator's JSON report (`--format JSON`) as a readable summary:
// every checked URL first, then the broken ones last so the failures are the
// final thing in a CI log.
//
// Usage: node link_report.mjs <linkinator-json>
//
// Exits 1 when the report holds broken links, and also when it cannot be
// parsed at all — an unreadable report is a failure in its own right, never a
// pass. Kept dependency-free (plain Node ESM) so it runs under the same Node
// the docs build already uses, with no extra tool in the check sandbox: this
// script replaced a `jq` pipeline that was absent from that sandbox, where the
// missing binary read as "unparseable JSON" and exited 0.

import fs from 'node:fs';

const [, , resultsPath] = process.argv;
if (!resultsPath) {
  console.error('usage: node link_report.mjs <linkinator-json>');
  process.exit(1);
}

const raw = fs.readFileSync(resultsPath, 'utf8');
const report = parseReport(raw);

if (report === null || !Array.isArray(report.links)) {
  console.error('❌ linkinator produced no usable JSON report. Raw output:');
  console.error(raw);
  process.exit(1);
}

// Anything that is neither OK, SKIPPED nor BROKEN — linkinator also emits the
// odd entry carrying only a `parent` — is kept in its own bucket so every
// link is accounted for and the counts always add up. It is reported but not
// treated as a failure: such stubs appear on runs with no broken links.
const ok = report.links.filter((link) => link.state === 'OK');
const skipped = report.links.filter((link) => link.state === 'SKIPPED');
const broken = report.links.filter((link) => link.state === 'BROKEN');
const unclassified = report.links.filter(
  (link) => !['OK', 'SKIPPED', 'BROKEN'].includes(link.state),
);

console.log();
console.log(
  `Checked ${report.links.length} links: ${ok.length} OK, ${skipped.length} skipped, ${broken.length} broken.`,
);

if (ok.length > 0) {
  console.log();
  console.log(`✅ ${ok.length} OK:`);
  for (const link of sortByUrl(ok)) {
    console.log(`     [${link.status ?? 0}] ${urlOf(link)}`);
  }
}

if (skipped.length > 0) {
  console.log();
  console.log(`⏭️  ${skipped.length} skipped:`);
  for (const link of sortByUrl(skipped)) {
    console.log(`     ${urlOf(link)}`);
  }
}

if (unclassified.length > 0) {
  console.log();
  console.log(`❔ ${unclassified.length} without a reported state:`);
  for (const link of sortByUrl(unclassified)) {
    console.log(
      `     ${urlOf(link)} (from ${link.parent ?? 'unknown source'})`,
    );
  }
}

if (broken.length === 0) {
  console.log();
  console.log('✅ No broken links found.');
  process.exit(0);
}

// Last, so the failures are what a reader sees at the end of the log.
console.log();
console.log(
  `❌ ${broken.length} broken link(s), grouped by the page they appear on:`,
);
for (const [parent, links] of groupByParent(broken)) {
  console.log();
  console.log(`📄 ${parent}`);
  for (const link of sortByUrl(links)) {
    console.log(`     [${link.status ?? 0}] ${urlOf(link)}`);
  }
}
process.exit(1);

/**
 * Parse linkinator's report, skipping any preamble (progress lines, a pnpm
 * lockfile warning) printed before the single top-level JSON object.
 *
 * @param {string} text
 * @returns {object | null} `null` when there is no parseable object.
 */
function parseReport(text) {
  const start = text.search(/^\{/m);
  if (start === -1) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start));
  } catch (err) {
    console.error(`❌ linkinator's JSON report did not parse: ${err.message}`);
    return null;
  }
}

function urlOf(link) {
  return link.url ?? '(no url reported)';
}

function sortByUrl(links) {
  return [...links].sort((a, b) => urlOf(a).localeCompare(urlOf(b)));
}

/**
 * Group links by the page they were found on, ordered by that page.
 *
 * @param {object[]} links
 * @returns {Map<string, object[]>}
 */
function groupByParent(links) {
  const groups = new Map();
  for (const link of links) {
    const parent = link.parent ?? '(unknown source)';
    const group = groups.get(parent);
    if (group === undefined) {
      groups.set(parent, [link]);
    } else {
      group.push(link);
    }
  }
  return new Map([...groups].sort(([a], [b]) => a.localeCompare(b)));
}
