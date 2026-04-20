#!/usr/bin/env bash

# This pinned version is bumped automatically by the changelog workflow.
VERSION="1.43.1"

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
REPO="nhost/nhost"

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

# resolve version (allow override via first argument)
version=${1:-$VERSION}
release="cli@$version"
log "Installing Nhost CLI version $version..."

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
elif [[ "$archstr" == 'arm64' || "$archstr" == 'aarch64' ]]; then
    arch='arm64'
else
    arch='386'
fi

# some variables
suffix="-${platform}-${arch}"

if [[ "$platform" != 'windows' ]]; then
    extension=".tar.gz"
else
    extension='.zip'
fi

# variables for install
targetFile="cli-$version$suffix$extension"

encodedRelease=$(echo $release | sed 's/@/%40/g')
url="https://github.com/${REPO}/releases/download/${encodedRelease}/${targetFile}"

# remove previous download
if [ -e $targetFile ]; then
    rm $targetFile
fi

# tell what we are downloading
log "${PURPLE}Downloading Nhost ${version} for ${platform}-${arch} to ${targetFile}${NC}"

# download and extract files
try curl -L -f -o $targetFile "$url"
try chmod +x $targetFile

if [[ "$platform" != 'windows' ]]; then
    try tar -xvf $targetFile
else
    try unzip $targetFile
fi

try rm ./$targetFile

# install and test
log "${GREEN}Download complete!${NC}"
echo

if [[ "$platform" != 'windows' ]]; then
    try sudo mv ./cli ${INSTALL_PATH}/nhost
    nhost --version
    echo
    log "${BLUE}Use Nhost CLI with: nhost --help${NC}"
else
    try mv cli.exe nhost.exe
    log "${BLUE}Please copy nhost.exe in a directory covered by your Windows path"
fi
