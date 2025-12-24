import "dotenv/config";
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { Endpoints } from "@octokit/types";

const GITHUB_ORG = "govuk-one-login";

type AlertResponse =
  Endpoints["GET /repos/{owner}/{repo}/dependabot/alerts"]["response"]["data"];
type Unpacked<T> = T extends (infer U)[] ? U : T;
type RawAlert = Unpacked<AlertResponse>;

type DependabotAlert = {
  repo: string;
  pod: string;
  alert_number: number;
  state: string;
  dependency: string;
  package_ecosystem: string;
  severity: string;
  created_at: Date;
  updated_at: Date;
  dismissed_at?: Date;
  fixed_at?: Date;
};

const RestOcto = Octokit.plugin(restEndpointMethods, paginateRest);
const octokit = new RestOcto({ auth: process.env.GITHUB_TOKEN });

const getAllRepos = async (
  limit?: number
): Promise<{ name: string; pod: string }[]> => {
  let repos;
  if (limit) {
    repos = (
      await octokit.rest.repos.listForOrg({
        org: GITHUB_ORG,
        type: "all",
        per_page: limit,
      })
    ).data.filter((repo) => !repo.archived);
  } else {
    repos = (
      await octokit.paginate(octokit.rest.repos.listForOrg, {
        org: GITHUB_ORG,
        type: "all",
        per_page: 100,
      })
    ).filter((repo) => !repo.archived);
  }

  const reposWithAlerts = [];
  for (const repo of repos) {
    try {
      await octokit.rest.dependabot.listAlertsForRepo({
        owner: GITHUB_ORG,
        repo: repo.name,
        per_page: 1,
      });
      const properties = await octokit.rest.repos.getCustomPropertiesValues({
        owner: GITHUB_ORG,
        repo: repo.name,
      });
      const podValue = properties.data.find(
        (item) => item.property_name === "pod"
      )?.value;
      const pod = Array.isArray(podValue) ? podValue[0] : podValue || "unknown";
      reposWithAlerts.push({ name: repo.name, pod });
    } catch (error) {
      // Skip repos where Dependabot alerts are not enabled
      console.warn(`Skipping ${repo.name}:`, error);
    }
  }
  return reposWithAlerts;
};

const getDependabotAlerts = async (repo: string): Promise<AlertResponse> => {
  try {
    const response = await octokit.paginate(
      octokit.rest.dependabot.listAlertsForRepo,
      {
        owner: GITHUB_ORG,
        repo: repo,
        per_page: 100,
      }
    );
    return response;
  } catch (error) {
    console.warn(`Failed to fetch alerts for ${repo}:`, error);
    return [];
  }
};

const transformAlert = (
  alert: RawAlert,
  repo: string,
  pod: string
): DependabotAlert => {
  return {
    repo,
    pod,
    alert_number: alert.number,
    state: alert.state,
    dependency: alert.dependency.package?.name ?? "Unknown package",
    package_ecosystem:
      alert.dependency.package?.ecosystem ?? "Unknown ecosystem",
    severity: alert.security_advisory.severity,
    created_at: new Date(alert.created_at),
    updated_at: new Date(alert.updated_at),
    dismissed_at: alert.dismissed_at ? new Date(alert.dismissed_at) : undefined,
    fixed_at: alert.fixed_at ? new Date(alert.fixed_at) : undefined,
  };
};

const processedAlerts: DependabotAlert[] = [];
const repos = await getAllRepos(100);

for (const repo of repos) {
  const alerts = await getDependabotAlerts(repo.name);
  for (const alert of alerts) {
    processedAlerts.push(transformAlert(alert, repo.name, repo.pod));
  }
}

console.log(JSON.stringify(processedAlerts));
