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
    await git(['remote', 'add', 'fork', `https://github.com/${args.repo}.git`]);
    
    await git(['config', '--local', 'user.name', args.user_name ]);
    await git(['config', '--local', 'user.email', args.email ]);

    await git(['fetch', 'origin', args.base_branch]);
    await git(['fetch', 'fork', args.head_branch]);
    
    await git(['checkout', '-b', args.head_branch, `fork/${args.head_branch}`]);
    await git(['rebase', `origin/${args.base_branch}`]);
    
    await git(['push', '--force-with-lease', 'fork', args.head_branch]);
};

const getMardownGif = async (giphy, phrase) => {
    const gif = await giphy.random(phrase);
    return `![${phrase}](${gif.data.image_url})`
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
            body: `:man_shrugging: github says this pr is already merged...\n\n${gif}`,
        })
        core.setFailed('already merged');
        process.exit(1);
    } else if (!prInfo.rebaseable) {
        const gif = await getMardownGif(giphy, 'no no!');
        await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: `:no_entry_sign: github says this pr is not rebaseable...\n\n${gif}`,
        });
        core.setFailed('not rebaseable');
        process.exit(1);
    }
    
    const user_name = context.payload.comment.user.login;
    const { email } = await ghClient.users.getByUsername({ user_name });
    // start actual rebase
    try {
        await rebase({
            repo: context.payload.repository.full_name,
            email,
            user_name,
            ...prInfo
        });
        const gif = await getMardownGif(giphy, 'whoop whoop');
        await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: `:sun_with_face: successfully rebased!!!\n\n${gif}`+
            `\n<details><summary>Details</summary>\n` +
            `\n<p>\n\n`+
            `\`\`\`bash\n`+
            `${execLogs}`+
            `\n\`\`\`\n`+
            `</p>\n`+
            `</details>`
        });
    } catch (error) {
        const gif = await getMardownGif(giphy, 'epic fail');
        await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: `:exclamation: i tried the rebase and failed...\n\n${gif}`+
            `\n<details><summary>Details</summary>\n` +
            `\n<p>\n\n`+
            `\`\`\`bash\n`+
            `${error}\n${execLogs}`+
            `\n\`\`\`\n`+
            `</p>\n`+
            `</details>`
        });
        core.setFailed(execLogs);
    }
};

run();
