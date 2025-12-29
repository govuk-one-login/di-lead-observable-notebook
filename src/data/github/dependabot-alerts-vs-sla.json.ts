import "dotenv/config";
import {Octokit} from "@octokit/core";
import {restEndpointMethods} from "@octokit/plugin-rest-endpoint-methods";
import {paginateRest} from "@octokit/plugin-paginate-rest";
import {Endpoints} from "@octokit/types";

const GITHUB_ORG = "govuk-one-login";

type AlertsResponse =
    Endpoints["GET /repos/{owner}/{repo}/dependabot/alerts"]["response"]["data"];
type RepositoriesResponse =
    Endpoints["GET /orgs/{org}/repos"]["response"]["data"];

// Responses are arrays that are themselves not typed, so we can infer the type the array is of with this magic
type Unpacked<T> = T extends (infer U)[] ? U : T;

// These represent the individual items returned by
type AlertResponse = Unpacked<AlertsResponse>;
type RepositoryResponse = Unpacked<RepositoriesResponse>;

const RestOctokit = Octokit.plugin(restEndpointMethods, paginateRest);
const octokit = new RestOctokit({auth: process.env.GITHUB_TOKEN});

type Repository = {
    id: number;
    name_text: string;
    html_url: string;
    name_link: [string, string];
    alerts: Alert[],
    archived: boolean,
    // - what dependabot alerts are out of SLA
    // - what can't be safely patched
    // - what's primary and has a patch (so presumably we can update)
    // - what's transitory and has a patch (so presumably trickier or more checks?)
}

type Alert = {
    name_text: string;
    in_repositories: number[];
}

type FormattedDataForObservable = {
    repositories: Repository[],
    alerts: Alert[],
}

const repositoryResponseToRepository = (response: RepositoryResponse): Repository => ({
    id: response.id,
    name_text: response.name ?? '',
    html_url: response.html_url ?? '',
    name_link: [
        response.name ?? '',
        response.html_url ??'',
    ],
    archived: response.archived ?? false,
    alerts: [],
});

const shouldShowRepository = (repository: Repository): boolean => (
    !repository.archived
    && !!repository.name_text
    && !!repository.html_url
);

const daysOpen = (createdAt: string) => {
    const now = new Date().getTime();
    const created = new Date(createdAt).getTime();
    // If createdAt is invalid, treat as unknown age
    if (Number.isNaN(created)) return null;

    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((now - created) / msPerDay);
};

const alertResponseToDependabotAlert = (response: AlertResponse): Alert => ({
    name_text: response.security_advisory.summary ?? '',
    in_repositories: [],
});

// It would be nice to have a single list of permissions a token needs both to inform users how to create one _and_ to
// test that a provided token has all permissions it needs. Unfortunately that's not currently possible with finr grain
// tokens.
// const checkPermissions = async () => {
//     console.info("Check permissions");
//     console.info(" - GitHub does not allow you to see Fine Grain token permissions 🤦🏻‍♂️");
// }

const getAllRepositories = (): Promise<RepositoriesResponse> => (
    octokit.paginate(
        octokit.rest.repos.listForOrg, {
            org: GITHUB_ORG,
            type: "all",
            per_page: 100,
        }
    )
);

// Get dependencies for a specific repository
const getDependabotAlerts = async (repo: string): Promise<AlertsResponse> => {
    try {
        // Returning awaits is weird, but we need it for the try/catch
        return await octokit.paginate(
            octokit.rest.dependabot.listAlertsForRepo,
            {
                owner: GITHUB_ORG,
                repo: repo,
                per_page: 100,
            }
        );
    } catch (error) {
        // console.warn(`Failed to fetch alerts for ${repo}:`, error);
        return [];
    }
};

// This function just to check the type of data written to Observable is correct
const outputObservableData = (data: FormattedDataForObservable) => (
    console.log(JSON.stringify(data))
);

(async () => {
    const rawRepoData = await getAllRepositories();
    const repositories = rawRepoData
        .map(repositoryResponseToRepository)
        .filter(shouldShowRepository);

    const alerts: Alert[] = [];

    for (const repository of repositories) {
        const alertsForRepoRaw = await getDependabotAlerts(repository.name_text);
        repository.alerts = alertsForRepoRaw.map(alertResponseToDependabotAlert);
        for (const alert of repository.alerts) {
            const existingAlert = alerts.find(({name_text}) => name_text === alert.name_text);
            if (!existingAlert) {
                alerts.push(alert);
            } else {
                existingAlert.in_repositories.push(repository.id);
            }
        }
    }

    const formattedData = {
        repositories,
        alerts,
    };
    outputObservableData(formattedData);
})();
