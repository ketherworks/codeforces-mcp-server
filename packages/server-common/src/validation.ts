import type { z } from "zod";

export interface FormatValidationErrorOptions {
  hint?: string;
  maxIssues?: number;
  maxLength?: number;
}

const DEFAULT_MAX_ISSUES = 4;
const DEFAULT_MAX_LENGTH = 480;

/**
 * Formats a Zod validation error into a concise, actionable, single-line message
 * naming the failing fields without echoing raw sensitive input values.
 */
export function formatSchemaValidationError(
  toolName: string,
  error: z.ZodError,
  options: FormatValidationErrorOptions = {}
): string {
  const maxIssues = options.maxIssues ?? DEFAULT_MAX_ISSUES;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const formattedIssues = collectIssueSummaries(error.issues);
  const shown = formattedIssues.slice(0, maxIssues);
  const remaining = formattedIssues.length - shown.length;
  const issuePart = shown.length > 0
    ? `${shown.join("; ")}${remaining > 0 ? ` (+${remaining} more)` : ""}`
    : "arguments did not match the expected schema";
  const prefix = `Invalid ${sanitize(toolName)} input: ${issuePart}.`;
  const combined = options.hint ? `${prefix} ${sanitize(options.hint)}` : prefix;
  return combined.length <= maxLength ? combined : `${combined.slice(0, maxLength - 3).trimEnd()}...`;
}

function collectIssueSummaries(issues: ReadonlyArray<z.core.$ZodIssue>): string[] {
  const summaries: string[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    const summary = summarizeIssue(issue);
    if (summary && !seen.has(summary)) {
      seen.add(summary);
      summaries.push(summary);
    }
  }
  return summaries;
}

function summarizeIssue(issue: z.core.$ZodIssue): string {
  const path = formatPath(issue.path);
  if (issue.code === "unrecognized_keys") {
    const keys = (issue as { keys?: ReadonlyArray<string> }).keys ?? [];
    const keyList = keys.slice(0, 5).map(sanitize).join(", ");
    const suffix = keys.length > 5 ? ` (+${keys.length - 5} more)` : "";
    const label = keyList ? `unexpected field(s): ${keyList}${suffix}` : "unexpected extra field(s)";
    return path === "arguments" ? label : `${path}: ${label}`;
  }
  if (issue.code === "invalid_union") {
    const branches = (issue as { errors?: ReadonlyArray<ReadonlyArray<z.core.$ZodIssue>> }).errors ?? [];
    const branchDetails = branches
      .map((branch) => collectIssueSummaries(branch).slice(0, 2).join(", "))
      .filter(Boolean);
    if (branchDetails.length > 0) {
      const uniqueBranches = [...new Set(branchDetails)].slice(0, 2);
      const joined = uniqueBranches.join(" | OR | ");
      return path === "arguments" ? `must match one valid shape (${joined})` : `${path}: ${joined}`;
    }
  }
  const message = sanitize(issue.message || "invalid value");
  return `${path}: ${message}`;
}

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) return "arguments";
  return path.map((segment) => sanitize(String(segment))).join(".");
}

function sanitize(value: string): string {
  return value.replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim();
}
