package gin

import "github.com/gin-gonic/gin"

type StrictGinHandlerFunc func(ctx *gin.Context, request interface{}) (response interface{}, err error)

type StrictGinMiddlewareFunc func(f StrictGinHandlerFunc, operationID string) StrictGinHandlerFunc
