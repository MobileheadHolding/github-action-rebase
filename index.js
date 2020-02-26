const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const ghClient = new github.GitHub(process.env.GITHUB_TOKEN);

let execLogs = '';

const execOptions = {
    listeners: {
        stdout: (data) => {
            execLogs += data.toString();
        },
        stderr: (data) => {
            execLogs += data.toString();
        }
    }
}

const git = (args) => {
    return exec.exec('git', args, execOptions);
}

const rebase = async (args) => {
    console.log(args)
    await git(['config', '--local', 'user.name', args.username ]);
    await git(['config', '--local', 'user.email', args.email ]);

    await git(['fetch', 'origin', args.base_branch ]);
    
    await git(['rebase', `origin/${args.base_branch}`]);
    
    await git(['push', '--force-with-lease']);
};

const getMardownGif = async (giphy, phrase) => {
    const gif = await giphy.random(phrase);
    return `![${phrase}](${gif.data.image_url})`
}

const gifComment = (comment, gif, details) => {
    return `${comment}\n\n${gif}`+
            `\n<details><summary>Details</summary>\n` +
            `\n<p>\n\n`+
            `\`\`\`bash\n`+
            `${details}`+
            `\n\`\`\`\n`+
            `</p>\n`+
            `</details>`
}

const run = async () => {
    const giphy_key = core.getInput('giphy-key');
    const giphy = require('giphy-api')(giphy_key);
    const context = await github.context;
    const pull_number = context.payload.issue.number;
    const owner = context.payload.repository.full_name.split('/')[0];
    const repo = context.payload.repository.name;
    if (! context.payload.comment.html_url.includes('pull')) {
        core.setFailed(`this is not a pr comment: ${JSON.stringify(context.payload)}`);
    }
    const initialPr = {
        owner,
        repo,
        pull_number
    }
    let pr = await ghClient.pulls.get(initialPr);
    const prInfo = {
        rebaseable: pr.data.rebaseable,
        merged: pr.data.merged,
        base_branch: pr.data.base.ref,
        head_branch: pr.data.head.ref
    }
    // check if rebaseable
    if (prInfo.merged) {
        const gif = await getMardownGif(giphy, 'what?');
        await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: gifComment(
                    `:man_shrugging: github says this pr is already merged...`, 
                    gif,
                    JSON.stringify(pr.data, null, 2),
                ),
        })
        core.setFailed('already merged');
        process.exit(1);
    } else if (prInfo.rebaseable == 'false') {
        const gif = await getMardownGif(giphy, 'no no!');
        await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: gifComment(
                `:no_entry_sign: github says this pr is not rebaseable...`, 
                gif,
                JSON.stringify(pr.data, null, 2),
            ),
        });
        core.setFailed('not rebaseable');
        process.exit(1);
    }
    
    const username = context.payload.comment.user.login;
    const { email } = await ghClient.users.getByUsername({ username });
    // start actual rebase
    try {
        await rebase({
            repo: context.payload.repository.full_name,
            email,
            username,
            ...prInfo
        });
        const gif = await getMardownGif(giphy, 'whoop whoop');
        await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: gifComment(
                `:sun_with_face: successfully rebased!!!`, 
                gif, 
                execLogs
            ),
        });
    } catch (error) {
        const gif = await getMardownGif(giphy, 'epic fail');
        await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: gifComment(
                `:sun_with_face: successfully rebased!!!`, 
                gif, 
                `${error}\n${execLogs}`
            ),
        });
        core.setFailed(execLogs);
    }
};

run();
