# * Set the default package manager to use if cannot be guessed from lock files
echo "defaultAgent=$PACKAGE_MANAGER" > ~/.nirc

# * Create a default package.json file if it doesn't exist yet
npm init -y 1> /dev/null

# * Start nodemon that listens to package.json and lock files and run npm/pnpm/yarn install,
# * Then run another nodemon that listens to the functions directory and run the server
nodemon --config $SERVER_PATH/nodemon.json package.json