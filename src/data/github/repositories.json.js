import "dotenv/config";
import fs from "fs";
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { paginateRest } from "@octokit/plugin-paginate-rest";

const { GITHUB_TOKEN } = process.env;  
const ORG = "govuk-one-login";

const RestOcto = Octokit.plugin(restEndpointMethods, paginateRest);
const octokit = new RestOcto({ auth: GITHUB_TOKEN });

// Function to fetch repositories for the given organization using pagination and iterator
const fetchRepositories = async () => {
  const iterator = octokit.paginate.iterator(octokit.rest.repos.listForOrg.endpoint.merge({
    org: ORG,
    per_page: 100,
  }));

  const allRepos = [];

  for await (const { data: repos } of iterator) {
    const reposWithProperties = await Promise.all(repos.map(async (repo) => {
      const properties = await octokit.rest.repos.getCustomPropertiesValues({ owner: ORG, repo: repo.name });
      // const sbom = await octokit.rest.dependencyGraph.exportSbom({ owner: ORG, repo: repo.name });
      return {
        name: repo.name,
        description: repo.description,
        private: repo.private,
        archived: repo.archived,
        pod: properties.data.filter(item => item.property_name === "pod")[0].value
        // sbom: sbom
      };
    }));

    allRepos.push(...reposWithProperties);
  }

  return allRepos;
};

// Main function to run the data loader
const main = async () => {
  const repos = await fetchRepositories();
  process.stdout.write(JSON.stringify(repos, null, 2))
  console.log('Repositories data written to .observable cache');
};

// Run the main function
main();
