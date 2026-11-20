import type { OjProblemSummary, OjSourceRef } from "@kaiserunix/oj-mcp-contracts";
import { ojProblemSummarySchema } from "@kaiserunix/oj-mcp-contracts";
import type { CodeforcesProblemsetResponse } from "./client.js";

export interface NormalizeCodeforcesOptions {
  fetchedAt: string;
  adapterVersion: string;
}

export function normalizeCodeforcesProblemset(payload: unknown, options: NormalizeCodeforcesOptions): OjProblemSummary[] {
  const response = payload as CodeforcesProblemsetResponse;
  const solvedByProblem = new Map(
    response.result.problemStatistics.map((statistic) => [statisticsIdentity(statistic), statistic.solvedCount])
  );

  return response.result.problems.map((problem) => {
    const identity = problemIdentity(problem);
    const nativeId = `${identity}/${problem.index}`;
    const problemUrl =
      problem.contestId !== undefined
        ? `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
        : `https://codeforces.com/problemsets/${encodeURIComponent(problem.problemsetName!)}`;
    const source: OjSourceRef = {
      kind: "official_api",
      adapterId: "codeforces-official-api",
      adapterVersion: options.adapterVersion,
      fetchedAt: options.fetchedAt,
      sourceUrl: "https://codeforces.com/api/problemset.problems",
      rawRef: nativeId,
      confidence: "authoritative"
    };
    return ojProblemSummarySchema.parse({
      schemaVersion: "oj.problem-summary/v1",
      ref: {
        schemaVersion: "oj.problem-ref/v1",
        platform: "codeforces",
        nativeId,
        canonicalId: `codeforces:${nativeId}`,
        url: problemUrl,
        contest: { nativeId: identity, index: problem.index },
        source
      },
      title: problem.name,
      difficulty: problem.rating === undefined ? undefined : { scale: "codeforces-rating", value: problem.rating },
      tags: problem.tags.map((tag) => ({ namespace: "platform", slug: slug(tag), name: tag })),
      acceptance: { accepted: solvedByProblem.get(statisticsLookupIdentity(problem)) },
      source
    });
  });
}

function problemIdentity(problem: CodeforcesProblemsetResponse["result"]["problems"][number]): string {
  return problem.contestId === undefined ? problem.problemsetName! : String(problem.contestId);
}

function statisticsIdentity(statistic: CodeforcesProblemsetResponse["result"]["problemStatistics"][number]): string {
  return statistic.contestId === undefined ? statistic.index : `${statistic.contestId}/${statistic.index}`;
}

function statisticsLookupIdentity(problem: CodeforcesProblemsetResponse["result"]["problems"][number]): string {
  return problem.contestId === undefined ? problem.index : `${problem.contestId}/${problem.index}`;
}

export function searchCodeforcesProblems(summaries: OjProblemSummary[], query: string, limit: number): OjProblemSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const normalizedIdQuery = normalizeCodeforcesProblemId(query).toLocaleLowerCase();
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return summaries
    .map((summary) => ({ summary, score: matchScore(summary, normalizedQuery, normalizedIdQuery, tokens) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.summary.ref.nativeId.localeCompare(right.summary.ref.nativeId))
    .slice(0, limit)
    .map((candidate) => candidate.summary);
}

export function normalizeCodeforcesProblemId(value: string): string {
  const trimmed = value.trim();
  const contestProblem = /^(\d+)\s*(?:[/-]\s*)?([a-z][a-z0-9]*)$/i.exec(trimmed);
  return contestProblem ? `${contestProblem[1]}/${contestProblem[2].toLocaleUpperCase()}` : trimmed;
}

function matchScore(summary: OjProblemSummary, query: string, idQuery: string, tokens: string[]): number {
  const id = summary.ref.nativeId.toLocaleLowerCase();
  if (id === idQuery) return 100;
  if (id.includes(idQuery)) return 80;
  const title = summary.title.toLocaleLowerCase();
  if (title === query) return 70;
  if (title.includes(query)) return 60;
  if (summary.tags.some((tag) => tag.name.toLocaleLowerCase().includes(query))) return 40;
  const ratingFilter = parseRatingToken(query);
  if (ratingFilter && matchesRating(summary.difficulty?.value, ratingFilter)) return 35;
  if (tokens.length > 1) {
    let tokenScore = 0;
    for (const token of tokens) {
      const score = matchSingleToken(summary, id, title, token);
      if (score === 0) return 0;
      tokenScore += score;
    }
    return Math.min(55, Math.round(tokenScore / tokens.length));
  }
  return 0;
}

function matchSingleToken(summary: OjProblemSummary, id: string, title: string, token: string): number {
  const tokenId = normalizeCodeforcesProblemId(token).toLocaleLowerCase();
  if (id === tokenId) return 55;
  if (title.includes(token)) return 45;
  if (summary.tags.some((tag) => tag.name.toLocaleLowerCase().includes(token))) return 40;
  const ratingFilter = parseRatingToken(token);
  if (ratingFilter && matchesRating(summary.difficulty?.value, ratingFilter)) return 35;
  if (id.includes(tokenId)) return 30;
  return 0;
}

function parseRatingToken(token: string): { min: number; max: number } | undefined {
  const normalized = token.replace(/^rating:/i, "");
  const range = /^(\d{3,4})\s*[-–]\s*(\d{3,4})$/.exec(normalized);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (min >= 800 && max <= 3500 && min <= max) return { min, max };
    return undefined;
  }
  const exact = /^(\d{3,4})$/.exec(normalized);
  if (exact) {
    const rating = Number(exact[1]);
    if (rating >= 800 && rating <= 3500 && rating % 100 === 0) return { min: rating, max: rating };
  }
  return undefined;
}

function matchesRating(value: number | undefined, filter: { min: number; max: number }): boolean {
  return value !== undefined && value >= filter.min && value <= filter.max;
}

function slug(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, "-");
}
