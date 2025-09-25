## Nhost User Contract

### Versioning
Nhost will follow a steady release cadence. Non breaking changes will be released as minor versions quarterly. Patch bug releases are at the discretion of the maintainers. Users can expect security patch fixes to be released within relatively short order of a CVE becoming known. For more information on security patch fixes see the CVE section below. Releases will follow [Semantic Versioning](https://semver.org/). Users tracking the Master branch should expect unpredictable breaking changes as the app continues to move forward. For stability, it is highly recommended to use a release.

### Backward Compatibility
We will maintain two major releases in a moving window. The N-1 release will only receive bug fixes and security updates and will be dropped once N+1 is released.

### Deprecation
Deprecation of Go versions or dependent packages will only occur in major releases. To reduce the change of this taking users by surprise, any large deprecation will be preceded by an announcement in the [Nhost discord server](https://discord.com/invite/9V7Qb2U) (preferably) or an Issue on Github.

### CVE
Maintainers will make every effort to release security patches in the case of a medium to high severity CVE directly impacting the utility. The speed in which these patches reach a release is up to the discretion of the maintainers. A low severity CVE may be a lower priority than a high severity one.

### Communication
Nhost CLI maintainers will use [GitHub discussions](https://github.com/nhost/cli/discussions) and the [Nhost discord server](https://discord.com/invite/9V7Qb2U) as the primary means of communication with the community. This is to foster open communication with all users and contributors.

### Breaking Changes
Breaking changes are generally allowed in the canary branch, as this is the branch used to develop the next release of Nhost.

There may be times, however, when canary is closed for breaking changes. This is likely to happen as we near the release of a new version.

Breaking changes are not allowed in release branches, as these represent minor versions that have already been released. These version have consumers who expect the APIs, behaviors, etc, to remain stable during the lifetime of the patch stream for the minor release.

Examples of breaking changes include:
- Removing or modifying the base domain for all API calls.
- Removing or modifying the behaviour of an API call, or a command.

Examples of minor changes include:
- Removing or renaming exported constant, variable, type, or function.
- Updating the version of critical libraries such as `fsnotify/fsnotify`, `spf13/pflag` etc...
- Some version updates may be acceptable for picking up bug fixes, but maintainers must exercise caution when reviewing.

There may, at times, need to be exceptions where breaking changes are allowed in release branches. These are at the discretion of the app's maintainers, and must be carefully considered before merging.

### CI Testing
Maintainers will ensure the Nhost test suite utilizes the current supported versions of Golang.

### Disclaimer
Changes to this document and the contents therein are at the discretion of the maintainers.
None of the contents of this document are legally binding in any way to the maintainers or the users.

# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, religion, or sexual identity
and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming,
diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment for our
community include:

* Demonstrating empathy and kindness toward other people
* Being respectful of differing opinions, viewpoints, and experiences
* Giving and gracefully accepting constructive feedback
* Accepting responsibility and apologizing to those affected by our mistakes,
  and learning from the experience
* Focusing on what is best not just for us as individuals, but for the
  overall community

Examples of unacceptable behavior include:

* The use of sexualized language or imagery, and sexual attention or
  advances of any kind
* Trolling, insulting or derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or email
  address, without their explicit permission
* Other conduct which could reasonably be considered inappropriate in a
  professional setting

## Enforcement Responsibilities

Community leaders are responsible for clarifying and enforcing our standards of
acceptable behavior and will take appropriate and fair corrective action in
response to any behavior that they deem inappropriate, threatening, offensive,
or harmful.

Community leaders have the right and responsibility to remove, edit, or reject
comments, commits, code, wiki edits, issues, and other contributions that are
not aligned to this Code of Conduct, and will communicate reasons for moderation
decisions when appropriate.

## Scope

This Code of Conduct applies within all community spaces, and also applies when
an individual is officially representing the community in public spaces.
Examples of representing our community include using an official e-mail address,
posting via an official social media account, or acting as an appointed
representative at an online or offline event.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the community leaders responsible for enforcement at
wahal@nhost.io.
All complaints will be reviewed and investigated promptly and fairly.

All community leaders are obligated to respect the privacy and security of the
reporter of any incident.

## Enforcement Guidelines

Community leaders will follow these Community Impact Guidelines in determining
the consequences for any action they deem in violation of this Code of Conduct:

### 1. Correction

**Community Impact**: Use of inappropriate language or other behavior deemed
unprofessional or unwelcome in the community.

**Consequence**: A private, written warning from community leaders, providing
clarity around the nature of the violation and an explanation of why the
behavior was inappropriate. A public apology may be requested.

### 2. Warning

**Community Impact**: A violation through a single incident or series
of actions.

**Consequence**: A warning with consequences for continued behavior. No
interaction with the people involved, including unsolicited interaction with
those enforcing the Code of Conduct, for a specified period of time. This
includes avoiding interactions in community spaces as well as external channels
like social media. Violating these terms may lead to a temporary or
permanent ban.

### 3. Temporary Ban

**Community Impact**: A serious violation of community standards, including
sustained inappropriate behavior.

**Consequence**: A temporary ban from any sort of interaction or public
communication with the community for a specified period of time. No public or
private interaction with the people involved, including unsolicited interaction
with those enforcing the Code of Conduct, is allowed during this period.
Violating these terms may lead to a permanent ban.

### 4. Permanent Ban

**Community Impact**: Demonstrating a pattern of violation of community
standards, including sustained inappropriate behavior,  harassment of an
individual, or aggression toward or disparagement of classes of individuals.

**Consequence**: A permanent ban from any sort of public interaction within
the community.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage],
version 2.0, available at
https://www.contributor-covenant.org/version/2/0/code_of_conduct.html.

Community Impact Guidelines were inspired by [Mozilla's code of conduct
enforcement ladder](https://github.com/mozilla/diversity).

[homepage]: https://www.contributor-covenant.org

For answers to common questions about this code of conduct, see the FAQ at
https://www.contributor-covenant.org/faq. Translations are available at
https://www.contributor-covenant.org/translations.