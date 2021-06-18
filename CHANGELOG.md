1. Completed the 1-1 mapping of Nhost CLI from Javascript to Golang.
2. Docker Compose dependency removed. Containers are now handled natively directly using Docker daemon.
3. Required Hasura CLI v.2.0.0-alpha11 binaries are automatically downloaded for the user depending on their operating system and architecture and stored in `$HOME/.nhost` aka the Nhost root directory.
4. Users may now directly run `nhost` command to use the complete pipeline of initializing the project, setting up front-end boilerplates and launching a local development environment for their project.
5. `nhost init` and `nhost dev` have been made action specific for ONLY initializing the project and launching a local dev environment, respectively.
6. Added global `-d` or `--debug` flag for printing debug level verbose logs. Default logging includes logs of level `info`, `warn`, 'error' and `fatal`.
7. Added global `-j` or `--json` flag in case the user wants to print the logs in JSON format.
8. Added global `--log-file` flag which, if passed, would concurrently write the logs (without colour, and with timestamps) to that file along with stdOut.
9. Added `health` command which checks scans for any running Nhost services, validates the health of their respective containers and performs service-exclusive health checks. This command is still `[WIP]`. It does the former job. Yet to build the latter one.
10. Added `upgrade` command to check for latest versions of this utility from Github release APIs of this repository, and download and install those versions if the user wishes so. This command is still `[WIP].`
11. Added `version` command which prints out the current utility version along with operating system and architecture.
12. Added `reset` command which deletes project specific `nhost/` and `.nhost/` directories. User can also do this task manually with `rm -rf`.
13. Added command specific documentations.
14. Set up a proper and sophisticated logging using `logrus`.
15. Automated the workflow more than before. Example: if the user is not logged in, then instead of preventing the user from launching dev environment and asking them to manually do `nhost login`, now the utility directly calls login functions whenever authentication is required for any command, and isn't accessible to it.
16. Improved support for those specific uses cases where user may not have direct manual access to host machine where the utility might have to be run. For example, if the `nhost login` command prompts the user to enter their email for authentication, the user may directly insert email with a `-e` or `--email` flag, like `nhost login -e my_email@gmail.com`.
17. Similar flags have been added to other commands to bypass input prompts as much as possible by directly passing validation inputs using flags.