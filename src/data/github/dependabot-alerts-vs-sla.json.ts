import "dotenv/config";
import {Octokit} from "@octokit/core";
import {restEndpointMethods, RestEndpointMethodTypes} from "@octokit/plugin-rest-endpoint-methods";
import {paginateRest} from "@octokit/plugin-paginate-rest";
import {Endpoints} from "@octokit/types";

const GITHUB_ORG = "govuk-one-login";

type AlertResponse =
    Endpoints["GET /repos/{owner}/{repo}/dependabot/alerts"]["response"]["data"];
type RepositoryResponse =
    Endpoints["GET /orgs/{org}/repos"]["response"]["data"];

const RestOcto = Octokit.plugin(restEndpointMethods, paginateRest);
const octokit = new RestOcto({auth: process.env.GITHUB_TOKEN});

type Repository = {
    name_text: string;
    html_url: string;
    name_link: [string, string];
}

const repositoryResponseToRepository = (response: RepositoryResponse): Repository => ({
    name_text: response.name,
    html_url: response.html_url,
    name_link: [
        response.name,
        response.html_url,
    ]
});

// It would be nice to have a single list of permissions a token needs both to inform users how to create one _and_ to
// test that a provided token has all permissions it needs. Unfortunately that's not currently possible with finr grain
// tokens.
// const checkPermissions = async () => {
//     console.info("Check permissions");
//     console.info(" - GitHub does not allow you to see Fine Grain token permissions 🤦🏻‍♂️");
// }

const getAllRepositories = async (): Promise<RepositoryResponse> => {
    return await octokit.paginate(
        octokit.rest.repos.listForOrg, {
            org: GITHUB_ORG,
            type: "all",
            per_page: 100,
        }
    )
}



(async () => {
    const rawData =await getAllRepositories();
    const formattedData = rawData.map(repositoryResponseToRepository);
    console.log(JSON.stringify(formattedData));
})();
