# Major Changes up to v1.0.0

This changelog only contains ahigh level overview/abstract of major design and workflow execution changes up to CLI `v1.0.0` from earlier versions.

If you want to read specific changelogs for every major (or breaking change), minor change and patch fix, read them on [release pages](http://github.com/mrinalwahal/cli/releases).

Changes:

1. Completed the 1-1 mapping of Nhost CLI from Javascript to Golang.
1. Docker Compose dependency removed. Containers are now handled natively directly using Docker's native SDK for Golang by accessing installed docker daemon.
1. Required Hasura CLI v.2.0.0-alpha11 binaries are automatically downloaded for the user depending on their operating system and architecture and stored in `$HOME/.nhost` aka the Nhost root directory.
1. Users may now directly run the all-powerful single `nhost` command to use the complete pipeline of initializing the project, cloning pre-configured Nhost compatible front-end templates subject to choice of framework, and launching a local development environment for their project.
1. Added `nhost templates` command clones pre-configured Nhost compatible front-end templates (exaxmple: NuxtJs, NextJs, ReactJs, etc.) subject to choice of framework in the `web/` directory in project root.
1. `nhost init` and `nhost dev` have been made action specific for ONLY initializing the project and launching a local dev environment, respectively.
1. Added global `-d` or `--debug` flag for printing debug level verbose logs. Default logging includes logs of level `info`, `warn`, 'error' and `fatal`.
1. Added global `-j` or `--json` flag in case the user wants to print the logs in JSON format.
1. Added global `--log-file` flag which, if passed, would concurrently write the logs (without colour, and with timestamps) to that file along with stdOut.
1. Added `health` command which checks scans for any running Nhost services, validates the health of their respective containers and performs service-exclusive health checks. This command is still `[WIP]`. It does the former job. Yet to build the latter one.
1. Added `upgrade` command to check for latest versions of this utility from Github release APIs of this repository, and download and install those versions.
1. Added `version` command which prints out the current utility version along with operating system and architecture. Additionally, checks for latest versions of the CLI available from repository's release API.
1. Added `reset` command which deletes project specific `nhost/`, `.env.development` and `.nhost/` directories. User can also do this task manually with `rm -rf`.
1. Added command specific documentations.
1. Set up a proper and sophisticated logging using `logrus`.
1. Automated the workflow more than before. Example: if the user is not logged in, then instead of preventing the user from launching dev environment and asking them to manually do `nhost login`, now the utility directly calls login functions whenever authentication is required for any command, and isn't accessible to it.
1. Improved support for those specific uses cases where user may not have direct manual access to host machine where the utility might have to be run. For example, if the `nhost login` command prompts the user to enter their email for authentication, the user may directly insert email with a `-e` or `--email` flag, like `nhost login -e my_email@gmail.com`.
1. Similar flags have been added to other commands to bypass input prompts as much as possible by directly passing validation inputs using flags.
1. Added live reloading for API container if `package.json` file is changed/modified.
1. Added `nhost support` command giving selection prompt to user to allow them to directly launch discord server or github discussions endpoints from terminal.