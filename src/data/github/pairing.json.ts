import "dotenv/config";
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { paginateRest } from "@octokit/plugin-paginate-rest";

const GITHUB_ORG = "govuk-one-login";
enum PairingState { NONE_PAIRED, SOME_PAIRED, ALL_PAIRED}
type PairingData = { repo: string; pr: string; state: PairingState };

const RestOcto = Octokit.plugin(restEndpointMethods, paginateRest);
const octokit = new RestOcto({ auth: process.env.GITHUB_TOKEN });

const getPairingDataForRepo = async (repo: string): Promise<PairingData[]> => {
    let pairingData = [];

    for await (let response of octokit.paginate.iterator(octokit.rest.pulls.list, {
        owner: GITHUB_ORG,
        repo: repo,
        state: "closed",
        sort: "created",
        direction: "desc",
        per_page: 100
    })) {

        if (pairingData.length >= 200) {
            break;
        }

        for (let pr of response.data) {

            let commits = await octokit.rest.pulls.listCommits({
                owner: GITHUB_ORG,
                repo: repo,
                pull_number: pr.number
            });

            let paired_commits = commits.data.filter(commit => commit.commit.message.includes("Co-authored-by")).length

            let state = PairingState.ALL_PAIRED;

            if (paired_commits < commits.data.length) {
                state = PairingState.SOME_PAIRED;
            }

            if (paired_commits == 0) {
                state = PairingState.NONE_PAIRED;
            }

            pairingData.push({repo: repo, pr: pr.number, state: state});

        }

        return pairingData;
    }
};

let data: PairingData[] = [];
let REPOS = [
    "authentication-api",
    "authentication-frontend",
    "di-account-management-backend",
    "di-account-management-frontend",
    "ipv-core-back",
    "ipv-core-front",
    "ipv-cri-uk-passport-back",
    "ipv-cri-uk-passport-front",
    "ipv-cri-kbv-api",
    "ipv-cri-kbv-front",
];
for (const repo of REPOS) {
    const pairingData = await getPairingDataForRepo(repo);
    data = data.concat(pairingData)
}
console.log(JSON.stringify(data));
