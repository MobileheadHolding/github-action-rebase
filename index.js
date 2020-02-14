const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('node-fetch');

const ghClient = new github.GitHub(process.env.GITHUB_TOKEN);

const rebase = () => {};

const 

const run = async () => {
    const context = await github.context;
    owner = core.getInput('owner') || context.payload.repository.full_name.split('/')[0];
    repo = core.getInput('repo') || context.payload.repository.full_name.split('/')[1];
    console.log(github)
    console.log(github.context.issue())

    daysOld = core.getInput('days-old');
    packageNameQuery = core.getInput('package-name-query');
    packageLimit = core.getInput('package-limit');
    versionRegex = RegExp(core.getInput('version-regex'));
    versionLimit = core.getInput('version-limit');

    let versionsToDelete = await getVersionsToDelete();
    let deletedVersions = [];
    for (const version of versionsToDelete) {
        core.debug(`will try to delete ${JSON.stringify(version)}`);
        await deleteVersion(version);
        deletedVersions.push(`${version.package}@${version.version}`);
    }
    core.setOutput('deletedVersions', deletedVersions.join(','));
};

run();
