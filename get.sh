#!/usr/bin/env bash

# helper functions
yell() { echo -e "${RED}FAILED> $* ${NC}" >&2; }
die() { yell "$*"; exit 1; }
try() { "$@" || die "failed executing: $*"; }
log() { echo -e "--> $*"; }
maybe_sudo() { $([ $NEED_SUDO ] && echo sudo) "$@"; }

# console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
PURPLE='\033[0;35m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

# basic variables
INSTALL_PATH=${INSTALL_PATH:-"/usr/local/bin"}
NEED_SUDO=${NEED_SUDO:-1}
REPO="nhost/cli"

# check for existing installation
hasCli=$(which nhost)
if [ "$?" = "0" ]; then
    log ""
    log "${GREEN}You already have the Nhost CLI at '${hasCli}'${NC}"
    export n=3
    log "${YELLOW}Downloading again in $n seconds... Press Ctrl+C to cancel.${NC}"
    log ""
    sleep $n
fi

# check for curl
hasCurl=$(which curl)
if [ "$?" = "1" ]; then
    die "You need to install curl to use this script."
fi

# get release version
release=${1:-latest}
log "Getting $release version..."
if [[ "$release" == "latest" ]]; then
    version=$(curl --silent "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' |  sed -E 's/.*"([^"]+)".*/\1/')
else
    version=$(curl --silent "https://api.github.com/repos/nhost/cli/tags" | grep "name" | sed -E 's/.*"([^"]+)".*/\1/' | grep "$release")
fi

# check version exists
if [ ! $version ]; then
    log "${YELLOW}"
    log "Failed while attempting to install Nhost CLI. Please manually install:"
    log ""
    log "2. Open your web browser and go to https://github.com/$REPO/releases/latest"
    log "2. Download the CLI from latest release for your platform. Name it 'nhost'."
    log "3. chmod +x ./cli"
    log "4. mv ./cli /usr/local/bin/nhost"
    log "${NC}"
    die "exiting..."
fi

# show latest version
if [[ "$release" == "latest" ]]; then
    log "Latest version is $version"
fi

# get platform
platform='unknown'
unamestr=`uname`
if [[ "$unamestr" == 'Linux' ]]; then
    platform='linux'
elif [[ "$unamestr" == 'Darwin' ]]; then
    platform='darwin'
elif [[ "$unamestr" == 'Windows' ]]; then
    platform='windows'
fi

# die for unknown platform
if [[ "$platform" == 'unknown' ]]; then
    die "Unknown OS platform"
fi

# set arch
arch='unknown'
archstr=`uname -m`
if [[ "$archstr" == 'x86_64' ]]; then
    arch='amd64'
elif [[ "$archstr" == 'arm64' ]]; then
    arch='arm64'
else
    arch='386'
fi

# variables for install
targetFile="cli-${version}-${platform}-${arch}.tar.gz"
url="https://github.com/${REPO}/releases/download/${version}/${targetFile}"

# remove previous download
if [ -e $targetFile ]; then
    rm $targetFile
fi

# tell what we are downloading
log "${PURPLE}Downloading Nhost ${version} for ${platform}-${arch} to ${targetFile}${NC}"

# download and extract files
try curl -L -f -o $targetFile "$url"
try tar -xvf $targetFile
try rm ./$targetFile
try mv cli nhost

# install and test
log "${GREEN}Download complete!${NC}"
echo
try sudo_maybe mv ./nhost ${INSTALL_PATH}/nhost
nhost version
echo
log "${BLUE}Use Nhost CLI with: nhost --help${NC}"
