package environment

import (
	"path/filepath"

	"github.com/nhost/cli-go/hasura"
	"github.com/nhost/cli-go/nhost"
	"github.com/nhost/cli-go/util"
)

// Explain what it does
func (e *Environment) Execute() error {

	var err error

	// Update environment state
	e.UpdateState(Executing)

	//	Cancel the execution context as soon as this function completed
	defer e.ExecutionCancel()

	// check if this is the first time dev env is running
	firstRun := !util.PathExists(filepath.Join(nhost.DOT_NHOST, "db_data"))
	if firstRun {
		log.Info("First run takes longer, please be patient")
	}

	// Validate the availability of required docker images,
	// and download the ones that are missing
	if err := e.CheckImages(); err != nil {
		return err
	}

	//	Generate configuration for every service.
	//	This generates all env vars, mount points and commands
	if err := e.Config.Init(e.Port); err != nil {
		return err
	}

	//	Create the Nhost network if it doesn't exist
	if err := e.PrepareNetwork(); err != nil {
		return err
	}

	// create and start the conatiners
	for _, item := range e.Config.Services {

		//	Only those services which have a container configuration
		//	This is being done to exclude FUNCTIONS
		if item.Config != nil {

			//	We are passing execution context, and not parent context,
			//	because if this execution is cancelled in between,
			//	we want docker to abort this procedure.
			if err := item.Run(e.Docker, e.ExecutionContext, e.Network); err != nil {
				return err
			}
		}
	}

	//
	//	Update the ports and IDs of services against the running ones
	//
	//	Fetch list of existing containers
	containers, err := e.GetContainers()
	if err != nil {
		return err
	}

	//	Wrap fetched containers as services in the environment
	_ = e.WrapContainersAsServices(containers)

	if err := e.HealthCheck(e.ExecutionContext); err != nil {
		return err
	}

	// Now that Hasura container is active,
	// initialize the Hasura client.
	e.Hasura = &hasura.Client{}
	if err := e.Hasura.Init(
		e.Config.Services["hasura"].Address,
		nhost.ADMIN_SECRET,
		nil,
	); err != nil {
		return err
	}

	//
	// Apply migrations and metadata
	//
	log.Info("Preparing your data")
	if err = e.Prepare(); err != nil {
		return err
	}

	//
	// Apply Seeds if required
	//
	if firstRun && util.PathExists(filepath.Join(nhost.SEEDS_DIR, nhost.DATABASE)) {
		if err = e.Seed(filepath.Join(nhost.SEEDS_DIR, nhost.DATABASE)); err != nil {
			log.Debug(err)
			e.Cleanup()
		}
	}

	return err
}
