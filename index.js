const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('node-fetch');

let owner, repo, pr_number;
const ghClient = new github.GitHub(process.env.GITHUB_TOKEN);

const rebase = () => {};

const run = async () => {
    const context = await github.context;
    owner = context.payload.repository.full_name.split('/')[0];
    repo = context.payload.repository.full_name.split('/')[1];
    issue_number = context.payload.issue.number;
    console.log(github.ref)
    console.log(github.base_ref);
    console.log(github.head_ref);
};

run();
