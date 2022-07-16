import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

@Injectable()
export class AppService {
  owner: string;
  repo: string;

  default_branch: string;

  octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  async checkSource(url: string) {
    [this.owner, this.repo] = url.replace(/\/$/, '').split('/').slice(-2);
    return this.octokit.rest.repos
      .get({
        owner: this.owner,
        repo: this.repo,
      })
      .then((res) => {
        if (res.data.source) {
          console.log(
            'This repo is a fork of another repo. The source repo is: ' +
              res.data.source.html_url,
          );
          [this.owner, this.repo] = res.data.source.forks_url
            .split('/')
            .slice(-3);
          this.default_branch = res.data.default_branch;
        } else {
          [this.owner, this.repo] = res.data.forks_url.split('/').slice(-3);
          this.default_branch = res.data.default_branch;
        }
      });
  }

  async getForks() {
    // INFO: Uncomment this line to get the recursive forks of the repo

    // let forkForks = forks.map(async fork => {
    //   try {
    //     return await octokit.paginate('GET /repos/{owner}/{repo}/forks', {
    //       owner: fork.owner.login,
    //       repo: fork.name,
    //       sort: 'stargazers',
    //       per_page: 100,
    //     })
    //   } catch (_err) {
    //     return []
    //   }
    // })
    // const res = await Promise.all(forkForks)
    // res.forEach(fork => forks.push(...fork))

    return this.octokit.paginate('GET /repos/{owner}/{repo}/forks', {
      owner: this.owner,
      repo: this.repo,
      sort: 'stargazers',
      per_page: 100,
    });
  }
  async findAllBranchesOfFork() {
    const forks = await this.getForks();
    const forkUrl = forks.map((fork) => {
      return {
        owner: fork.owner.login,
        repo: fork.name,
        html_url: fork.html_url,
      };
    });

    const result = forkUrl.map(async (response) => {
      try {
        const res = await this.octokit.rest.repos.listBranches({
          owner: response.owner,
          repo: response.repo,
        });
        const branches = res.data.map((val) => val.name);
        return {
          branches,
          ...response,
        };
      } catch (_err) {
        return null;
      }
    });

    return Promise.all(result);
  }

  async findForkAheadCommits(url: string) {
    await this.checkSource(url);
    const result = await this.findAllBranchesOfFork();
    const data = result.map(async (r) => {
      if (!r) {
        return null;
      }
      const ahead_commits = r.branches.map(async (branch) => {
        try {
          const commits = await this.octokit.request(
            `GET /repos/${this.owner}/${this.repo}/compare/${this.default_branch}...{owner}%3A${branch}`,
            {
              owner: r.owner,
            },
          );
          if (commits.data.ahead_by > 0) {
            const ahead = commits.data.commits.map((commit: any) => {
              return {
                committer: commit.commit.committer.name,
                email: commit.commit.committer.email,
                date: commit.commit.committer.date,
                message: commit.commit.message,
                html_url: commit.html_url,
              };
            });

            const response = await Promise.all(ahead);
            return {
              branch,
              commits: response,
            };
          }
          return {
            branch,
            commits: 'No commits ahead',
          };
        } catch (_err) {
          return {
            branch,
            commits: 'No common ancestor',
          };
        }
      });

      const checkSourceTree = await Promise.all(ahead_commits);
      if (
        checkSourceTree.every((res) => res.commits === 'No common ancestor')
      ) {
        return {
          owner: r.owner,
          repo: r.repo,
          html_url: r.html_url,
          error:
            "Can't compare 2 repos because they have entirely different commit histories on all branches",
        };
      }
      return {
        owner: r.owner,
        repo: r.repo,
        html_url: r.html_url,
        ahead_commits: checkSourceTree,
      };
    });
    return Promise.all(data);
  }
}
