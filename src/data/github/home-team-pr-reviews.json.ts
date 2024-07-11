import "dotenv/config";
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { Endpoints } from "@octokit/types";

const GITHUB_ORG = "govuk-one-login";

const REPOS = [
  "di-account-management-backend",
  "di-account-management-frontend",
  "account-management-stubs",
];

const PRS_PER_REPO = 50;

type Unpacked<T> = T extends (infer U)[] ? U : T;
type PrResponse =
  Endpoints["GET /repos/{owner}/{repo}/pulls"]["response"]["data"];
type RawPrData = Unpacked<PrResponse>;
type PrData = {
  repo: string;
  number: number;
  created_at: Date;
  merged_at: Date;
  first_reviewed: Date;
  author: string | undefined;
  reviewer: string;
  created_hour?: number;
  created_day?: number;
  first_reviewed_hour?: number;
  first_reviewed_day?: number;
  merged_hour?: number;
  merged_day?: number;
  time_create_to_review?: number;
  time_review_to_merge?: number;
  time_create_to_merge?: number;
  working_time_create_to_review?: number;
  working_time_review_to_merge?: number;
  working_time_create_to_merge?: number;
  created_morning_or_afternoon?: "morning" | "afternoon";
};
type ReviewSummary = {
  submitted_at: string;
  reviewer: string;
};

const RestOcto = Octokit.plugin(restEndpointMethods, paginateRest);
const octokit = new RestOcto({ auth: process.env.GITHUB_TOKEN });

const getMostRecentPrsforRepo = async (repo: string): Promise<PrResponse> => {
  const response = await octokit.rest.pulls.list({
    owner: GITHUB_ORG,
    repo: repo,
    state: "closed",
    sort: "created",
    direction: "desc",
    per_page: PRS_PER_REPO,
  });
  return response.data;
};

const removeDependabotPrs = (prs: PrResponse): PrResponse => {
  return prs.filter((pr) => pr.user && pr.user.login !== "dependabot[bot]");
};

const getFirstReviewforPr = async (
  pr: RawPrData,
  repo: string
): Promise<ReviewSummary> => {
  const reviews = await octokit.rest.pulls.listReviews({
    owner: GITHUB_ORG,
    repo: repo,
    pull_number: pr.number,
  });

  // Find the earliest review by submit time
  const first = reviews.data.reduce((prev, current) => {
    return prev &&
      prev.submitted_at &&
      current.submitted_at &&
      prev.submitted_at < current.submitted_at
      ? prev
      : current;
  });

  if (first.submitted_at && first.user) {
    return { submitted_at: first.submitted_at, reviewer: first.user?.login };
  } else {
    throw new Error(`No submitted reviews found for PR #${pr.number}`);
  }
};

const getDataforPr = async (pr: RawPrData, repo: string): Promise<PrData> => {
  if (pr.merged_at) {
    const review = await getFirstReviewforPr(pr, repo);
    return {
      repo,
      number: pr.number,
      created_at: new Date(pr.created_at),
      merged_at: new Date(pr.merged_at),
      first_reviewed: new Date(review.submitted_at),
      author: pr.user?.login,
      reviewer: review.reviewer,
    };
  } else {
    throw new Error(`No merge time found for PR #${pr.number}`);
  }
};

const workingHoursBetween = (start: Date, end: Date): number => {
  // Assuming a 8-6 work day, how many working milliseconds are between two dates?
  // 8-6 is a long day but accounts for people who choose to start early or finish late

  const fullDifference = end.getTime() - start.getTime();

  // If the same day, return the simple difference
  if (
    start.getFullYear() == end.getFullYear() &&
    start.getMonth() == end.getMonth() &&
    start.getDate() == end.getDate()
  ) {
    return fullDifference;
  }

  // Otherwise count the full days between the dates, the time from the start to
  // the end of that working day, and the time from the start of the working day
  // to the end date
  var fullDaysBetween = Math.floor(fullDifference / (1000 * 60 * 60 * 24));

  // If it's friday, subtract 2 days for the weekend
  // Days are 0 indexed but 0 is Sunday...
  if (start.getDay() == 5) {
    fullDaysBetween = fullDaysBetween - 2;
  }
  const timeFromStartToWorkingDayEnd = Math.max(
    Date.UTC(start.getFullYear(), start.getUTCMonth(), start.getUTCDate(), 18) -
      start.getTime(),
    0
  );
  const timeFromWorkingDayStartToEnd = Math.max(
    end.getTime() -
      Date.UTC(end.getFullYear(), end.getUTCMonth(), end.getUTCDate(), 8),
    0
  );

  return (
    timeFromStartToWorkingDayEnd +
    timeFromWorkingDayStartToEnd +
    fullDaysBetween * (1000 * 60 * 60 * (18 - 8))
  );
};

const enrichPrData = (pr: PrData): PrData => {
  return {
    ...pr,
    created_day: pr.created_at.getDay(),
    created_hour: pr.created_at.getHours(),
    first_reviewed_day: pr.first_reviewed.getDay(),
    first_reviewed_hour: pr.first_reviewed.getHours(),
    merged_day: pr.merged_at.getDay(),
    merged_hour: pr.merged_at.getHours(),
    time_create_to_review:
      pr.first_reviewed.getTime() - pr.created_at.getTime(),
    time_review_to_merge: pr.merged_at.getTime() - pr.first_reviewed.getTime(),
    time_create_to_merge: pr.merged_at.getTime() - pr.created_at.getTime(),
    working_time_create_to_review: workingHoursBetween(
      pr.created_at,
      pr.first_reviewed
    ),
    working_time_review_to_merge: workingHoursBetween(
      pr.first_reviewed,
      pr.merged_at
    ),
    working_time_create_to_merge: workingHoursBetween(
      pr.created_at,
      pr.merged_at
    ),
    created_morning_or_afternoon:
      pr.created_at.getHours() < 12 ? "morning" : "afternoon",
  };
};

// This isn't very promisey or fast but processing them one by one means
// we can drop any closed PRs that don't have a review
const processedPrs: PrData[] = [];
for (const repo of REPOS) {
  const prs = await getMostRecentPrsforRepo(repo);
  const prsNoDependabot = removeDependabotPrs(prs);
  for (const pr of prsNoDependabot) {
    try {
      const data = await getDataforPr(pr, repo);
      processedPrs.push(enrichPrData(data));
    } catch (e) {}
  }
}
console.log(JSON.stringify(processedPrs));
