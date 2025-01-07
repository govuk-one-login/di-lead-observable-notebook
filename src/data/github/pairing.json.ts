import "dotenv/config";
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { paginateRest } from "@octokit/plugin-paginate-rest";

const GITHUB_ORG = "govuk-one-login";
enum PairingState { NONE_PAIRED, SOME_PAIRED, ALL_PAIRED}
type PairingData = { repo: string; pr: string; state: PairingState, when: string };

const RestOcto = Octokit.plugin(restEndpointMethods, paginateRest);
const octokit = new RestOcto({ auth: process.env.GITHUB_TOKEN });

const CO_AUTHORED_BY = /[cC]o-[aA]uthored-[bB]y\:/;

const getPairingDataForRepo = async (repo: string, limit: number): Promise<PairingData[]> => {
    let pairingData = [];

    for await (let response of octokit.paginate.iterator(octokit.rest.pulls.list, {
        owner: GITHUB_ORG,
        repo: repo,
        state: "closed",
        sort: "created",
        direction: "desc",
        per_page: 20
    })) {
        for (let pr of response.data) {
            if (pairingData.length >= limit || pr.closed_at < "2025-11-25") {
                break;
            }

            if (!pr.user || pr.user.login == "dependabot[bot]") {
                continue;
            }

            let commits = await octokit.rest.pulls.listCommits({
                owner: GITHUB_ORG,
                repo: repo,
                pull_number: pr.number,
                when: pr.closed_at
            });

            let paired_commits = commits.data
                .map(commit => commit.commit.message)
                .filter(commit => CO_AUTHORED_BY.test(commit))

            let state = PairingState.ALL_PAIRED;

            if (paired_commits.length < commits.data.length) {
                state = PairingState.SOME_PAIRED;
            }

            if (paired_commits.length == 0) {
                state = PairingState.NONE_PAIRED;
            }

            pairingData.push({repo: repo, pr: pr.number, state: PairingState[state]});

        }

        if (pairingData.length >= limit) {
            break;
        }


    }

    return pairingData;
};

let data: PairingData[] = [];

let REPOS = [
    "authentication-api",
    "authentication-frontend",
    "authentication-acceptance-tests",
    "authentication-smoke-tests",
    "authentication-stubs",

];
for (const repo of REPOS) {
    const pairingData = await getPairingDataForRepo(repo, 20);
    data = data.concat(pairingData)
}

console.log(JSON.stringify(data));
