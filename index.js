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
    const repo_link = `https://${args.user_name}:${args.token}@github.com/${args.repo}.git`
    
    await git(['remote', 'set-url', 'origin', repo_link])
    await git(['config', '--local', 'user.name', `\"${args.user_name}\"`]);
    await git(['config', '--local', 'user.email', args.user_email ]);
    await git(['config', '--list'])
    await git(['remote', 'add', 'fork', repo_link]);
       
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
    let pr = await ghClient.pulls.get({
        owner,
        repo,
        pull_number
    });
    const prInfo = {
        rebaseable: pr.data.rebaseable,
        merged: pr.data.merged,
        base_repo: pr.data.base.repo.full_name,
        base_branch: pr.data.base.ref,
        head_repo: pr.data.head.repo.full_name,
        head_branch: pr.data.head.ref
    }
    // check if rebaseable
    if (prInfo.merged) {
        const gif = await getMardownGif(giphy, 'what?');
        let comment = await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: `:man_shrugging: github says this pr is already merged...\n\n${gif}`,
        })
        core.setFailed('already merged');
        process.exit(1);
    } else if (!prInfo.rebaseable) {
        const gif = await getMardownGif(giphy, 'no no!');
        let comment = await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: `:no_entry_sign: github says this pr is not rebaseable...\n\n${gif}`,
        });
        core.setFailed('not rebaseable');
        process.exit(1);
    }
    // start actual rebase
    const login_name = context.payload.comment.user.login;
    const { email } = await ghClient.users.getByUsername({
        username: login_name
    });
   
    try {
        await rebase({
            user_email: email || `${login_name}@users.noreply.github.com`,
            user_name: process.env.GITHUB_USER_NAME || login_name,
            token: process.env.GITHUB_USER_TOKEN || process.env.GITHUB_TOKEN,
            repo: context.payload.repository.full_name,
            base_branch: prInfo.base_branch,
            head_branch: prInfo.head_branch
        });
        const gif = await getMardownGif(giphy, 'whoop whoop');
        let comment = await ghClient.issues.createComment({
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
        let comment = await ghClient.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: `:exclamation: i tried the rebase and failed...\n\n${gif}`+
            `\n<details><summary>Details</summary>\n` +
            `\n<p>\n\n`+
            `\`\`\`bash\n`+
            `${execLogs}`+
            `\n\`\`\`\n`+
            `</p>\n`+
            `</details>`
        });
        core.setFailed(execLogs);
    }
    
};

run();
