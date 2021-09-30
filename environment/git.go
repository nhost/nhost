package environment

import (
	"context"
	"errors"
	"io/fs"
	"path/filepath"

	"github.com/mrinalwahal/cli/nhost"
	"github.com/mrinalwahal/cli/util"
)

func getBranchHEAD(root string) string {

	//
	// HEAD Selection Logic
	//
	// 1.If $GIT_DIR/<refname> exists,
	// that is what you mean (this is usually useful only for HEAD,
	// FETCH_HEAD, ORIG_HEAD, MERGE_HEAD and CHERRY_PICK_HEAD);

	// 2.otherwise, refs/<refname> if it exists;
	// 3.otherwise, refs/tags/<refname> if it exists;
	// 4.otherwise, refs/heads/<refname> if it exists;
	// 5.otherwise, refs/remotes/<refname> if it exists;
	// 6.otherwise, refs/remotes/<refname>/HEAD if it exists.

	var response string
	branch := nhost.GetCurrentBranch()

	// The priority order these paths are added in,
	// is extremely IMPORTANT
	tree := []string{
		root,
		filepath.Join(root, "HEAD"),
		filepath.Join(root, branch),
		filepath.Join(root, branch, "HEAD"),
	}

	f := func(path string, dir fs.DirEntry, err error) error {
		for _, file := range tree {
			if util.PathExists(file) && file == path && !dir.IsDir() {
				response = path
				return nil
			}
		}
		return errors.New("git HEAD not found")
	}

	if err := filepath.WalkDir(root, f); err != nil {
		log.Debug(err)
		return ""
	}

	return response
}

func (e *Environment) restartMigrations() error {

	//
	//	Only perform operations if environment is active and available.
	//
	//	If the environment is not yet active,
	//	when it does become active, and performs migrations,
	//	only the new migrations will be applied.

	if e.State == Active {

		// Inform the user of detection
		log.Info("We've detected change in local git commit")
		log.Warn("We're fixing your data accordingly. Give us a moment!")

		// Initialize cancellable context ONLY for this shutdown oepration
		e.ExecutionContext, e.ExecutionCancel = context.WithCancel(e.Context)

		// re-do migrations and metadata
		if err := e.Prepare(); err != nil {
			return err
		}

		log.Info("Done! Please continue with your work.")
	}

	return nil
}

func (e *Environment) restartAfterCheckout() error {

	//
	//	The implemented logic below, should take care of following test cases:
	//
	//	Situation 1 [git checkout {branch}]:
	//		- Environment is active
	//		- User performs git checkout
	//		- Restart environment
	//
	//	Situation 2 [git checkout {branch} && git checkout {branch}]:
	//		- Environment restarting, but not yet active
	//		- User performs git checkout
	//		- Stop the restart
	//		- Shutdown whatever minimal environment may be created (delete services)
	//		- Restart environment
	//		- This must be true in an infinite loop fashion

	// Inform the user of detection
	log.Info("We've detected change in local git branch")

	if e.State >= Executing {

		//	If the environment is already shutting down,
		//	then no point in triggering new migrations,
		//	since in the post-shutdown OR next execution,
		//	new migrations will be applied.
		if e.State == ShuttingDown {
			return nil
		}

		//	Stop any ongoing execution of our environment
		e.ExecutionCancel()

		// Initialize cancellable context ONLY for this shutdown oepration
		e.ExecutionContext, e.ExecutionCancel = context.WithCancel(e.Context)

		// Shutdown and remove the services
		e.Shutdown(true, e.ExecutionContext)

		// Complete the shutdown
		e.ExecutionCancel()
	}

	log.Warn("We're recreating your environment accordingly. Give us a moment!")

	// update DOT_NHOST directory
	nhost.DOT_NHOST, _ = nhost.GetDotNhost()

	// register new branch HEAD for the watcher
	head := getBranchHEAD(filepath.Join(nhost.GIT_DIR, "refs", "remotes", nhost.REMOTE))
	if head != "" {

		if !e.Watcher.Registered(head) {
			e.Watcher.Register(head, e.restartMigrations)
		}
	}

	// now re-execute the environment
	e.ExecutionContext, e.ExecutionCancel = context.WithCancel(e.Context)
	if err := e.Execute(); err != nil {

		// cleanup and return an error
		e.Cleanup()
		return err
	}

	log.Info("Done! Please continue with your work.")
	return nil
}
