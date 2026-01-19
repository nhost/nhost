#!/bin/sh

VERSION="4.2.284"

npm pack mintlify@$VERSION
tar xvzf mintlify-$VERSION.tgz
cd package
npm install
rm -rf node_modules
