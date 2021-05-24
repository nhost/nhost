# Contributing to Nhost CLI

1. Fork this repository

2. Clone your forked repository

```bash
# replace USERNAME below with your GitHub username
git clone git@github.com:USERNAME/cli.git
cd cli
```

3. Create a new branch: `git checkout -b MY_BRANCH_NAME`

4. Install the dependencies: `yarn`

5. Add alias for local testing in `~/.bashrc` or `~/.zshrc`:

```
alias nhostlocal='<path-to-cli-repo>/bin/run'
```

6. Open up a new terminal for the alias to take effect.

7. Test your local nhost CLI version with: `nhostlocal version`
