-- name: GetAppDesiredState :one
SELECT desired_state FROM apps WHERE id = $1;
