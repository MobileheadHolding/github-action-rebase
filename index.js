const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('node-fetch');

const ghClient = new github.GitHub(process.env.GITHUB_TOKEN);

const rebase = () => {};

const run = async () => {
    const context = await github.context;
    owner = core.getInput('owner') || context.payload.repository.full_name.split('/')[0];
    repo = core.getInput('repo') || context.payload.repository.full_name.split('/')[1];
    console.log(github)
    console.log(github.context.payload);
    console.log(github.context.issue())
};

run();
