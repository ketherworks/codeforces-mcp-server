import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../packages/codeforces/package.json", import.meta.url), "utf8")
);
const actualTag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
const expectedTag = `v${manifest.version}`;

if (actualTag !== expectedTag) {
  console.error(`Release tag ${actualTag ?? "<missing>"} does not match package version ${expectedTag}.`);
  process.exit(1);
}

process.stdout.write(`Release tag ${actualTag} matches package version.\n`);
