go-graphql-client
=======

[![Build Status](https://travis-ci.org/hasura/go-graphql-client.svg?branch=master)](https://travis-ci.org/hasura/go-graphql-client.svg?branch=master) [![GoDoc](https://godoc.org/github.com/hasura/go-graphql-client?status.svg)](https://pkg.go.dev/github.com/hasura/go-graphql-client)

**Preface:** This is a fork of `https://github.com/shurcooL/graphql` with extended features (subscription client, named operation)

The subscription client follows Apollo client specification https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md, using websocket protocol with https://github.com/nhooyr/websocket, a minimal and idiomatic WebSocket library for Go.

Package `graphql` provides a GraphQL client implementation.

For more information, see package [`github.com/shurcooL/githubv4`](https://github.com/shurcooL/githubv4), which is a specialized version targeting GitHub GraphQL API v4. That package is driving the feature development.

**Status:** In active early research and development. The API will change when opportunities for improvement are discovered; it is not yet frozen.

- [go-graphql-client](#go-graphql-client)
	- [Installation](#installation)
	- [Usage](#usage)
		- [Authentication](#authentication)
		- [Simple Query](#simple-query)
		- [Arguments and Variables](#arguments-and-variables)
		- [Custom scalar tag](#custom-scalar-tag)
		- [Skip GraphQL field](#skip-graphql-field)
		- [Inline Fragments](#inline-fragments)
		- [Specify GraphQL type name](#specify-graphql-type-name)
		- [Mutations](#mutations)
			- [Mutations Without Fields](#mutations-without-fields)
		- [Execute](#execute)
		- [Subscription](#subscription)
			- [Usage](#usage-1)
			- [Subscribe](#subscribe)
			- [Authentication](#authentication-1)
			- [Options](#options)
			- [Events](#events)
			- [Custom HTTP Client](#custom-http-client)
			- [Custom WebSocket client](#custom-websocket-client)
		- [Options](#options-1)
		- [With operation name (deprecated)](#with-operation-name-deprecated)
		- [Raw bytes response](#raw-bytes-response)
		- [Multiple mutations with ordered map](#multiple-mutations-with-ordered-map)
		- [Debugging and Unit test](#debugging-and-unit-test)
	- [Directories](#directories)
	- [References](#references)
	- [License](#license)
  
## Installation

`go-graphql-client` requires Go version 1.13 or later.

```bash
go get -u github.com/hasura/go-graphql-client
```

## Usage

Construct a GraphQL client, specifying the GraphQL server URL. Then, you can use it to make GraphQL queries and mutations.

```Go
client := graphql.NewClient("https://example.com/graphql", nil)
// Use client...
```

### Authentication

Some GraphQL servers may require authentication. The `graphql` package does not directly handle authentication. Instead, when creating a new client, you're expected to pass an `http.Client` that performs authentication. The easiest and recommended way to do this is to use the [`golang.org/x/oauth2`](https://golang.org/x/oauth2) package. You'll need an OAuth token with the right scopes. Then:

```Go
import "golang.org/x/oauth2"

func main() {
	src := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("GRAPHQL_TOKEN")},
	)
	httpClient := oauth2.NewClient(context.Background(), src)

	client := graphql.NewClient("https://example.com/graphql", httpClient)
	// Use client...
```

### Simple Query

To make a GraphQL query, you need to define a corresponding Go type.

For example, to make the following GraphQL query:

```GraphQL
query {
	me {
		name
	}
}
```

You can define this variable:

```Go
var query struct {
	Me struct {
		Name graphql.String
	}
}
```

Then call `client.Query`, passing a pointer to it:

```Go
err := client.Query(context.Background(), &query, nil)
if err != nil {
	// Handle error.
}
fmt.Println(query.Me.Name)

// Output: Luke Skywalker
```

### Arguments and Variables

Often, you'll want to specify arguments on some fields. You can use the `graphql` struct field tag for this.

For example, to make the following GraphQL query:

```GraphQL
{
	human(id: "1000") {
		name
		height(unit: METER)
	}
}
```

You can define this variable:

```Go
var q struct {
	Human struct {
		Name   graphql.String
		Height graphql.Float `graphql:"height(unit: METER)"`
	} `graphql:"human(id: \"1000\")"`
}
```

Then call `client.Query`:

```Go
err := client.Query(context.Background(), &q, nil)
if err != nil {
	// Handle error.
}
fmt.Println(q.Human.Name)
fmt.Println(q.Human.Height)

// Output:
// Luke Skywalker
// 1.72
```

However, that'll only work if the arguments are constant and known in advance. Otherwise, you will need to make use of variables. Replace the constants in the struct field tag with variable names:

```Go
var q struct {
	Human struct {
		Name   graphql.String
		Height graphql.Float `graphql:"height(unit: $unit)"`
	} `graphql:"human(id: $id)"`
}
```

Then, define a `variables` map with their values:

```Go
variables := map[string]interface{}{
	"id":   graphql.ID(id),
	"unit": starwars.LengthUnit("METER"),
}
```

Finally, call `client.Query` providing `variables`:

```Go
err := client.Query(context.Background(), &q, variables)
if err != nil {
	// Handle error.
}
```

### Custom scalar tag

Because the generator reflects recursively struct objects, it can't know if the struct is a custom scalar such as JSON. To avoid expansion of the field during query generation, let's add the tag `scalar:"true"` to the custom scalar. If the scalar implements the JSON decoder interface, it will be automatically decoded.

```Go
struct {
	Viewer struct {
		ID         interface{}
		Login      string
		CreatedAt  time.Time
		DatabaseID int
	}
}

// Output:
// {
//   viewer {
//	   id
//		 login
//		 createdAt
//		 databaseId
//   }	
// }

struct {
	Viewer struct {
		ID         interface{}
		Login      string
		CreatedAt  time.Time
		DatabaseID int
	} `scalar:"true"`
}

// Output
// { viewer }
```

### Skip GraphQL field

```go
struct {
  Viewer struct {
		ID         interface{} `graphql:"-"`
		Login      string
		CreatedAt  time.Time `graphql:"-"`
		DatabaseID int
  }
}

// Output
// {viewer{login,databaseId}}
```

### Inline Fragments

Some GraphQL queries contain inline fragments. You can use the `graphql` struct field tag to express them.

For example, to make the following GraphQL query:

```GraphQL
{
	hero(episode: "JEDI") {
		name
		... on Droid {
			primaryFunction
		}
		... on Human {
			height
		}
	}
}
```

You can define this variable:

```Go
var q struct {
	Hero struct {
		Name  graphql.String
		Droid struct {
			PrimaryFunction graphql.String
		} `graphql:"... on Droid"`
		Human struct {
			Height graphql.Float
		} `graphql:"... on Human"`
	} `graphql:"hero(episode: \"JEDI\")"`
}
```

Alternatively, you can define the struct types corresponding to inline fragments, and use them as embedded fields in your query:

```Go
type (
	DroidFragment struct {
		PrimaryFunction graphql.String
	}
	HumanFragment struct {
		Height graphql.Float
	}
)

var q struct {
	Hero struct {
		Name          graphql.String
		DroidFragment `graphql:"... on Droid"`
		HumanFragment `graphql:"... on Human"`
	} `graphql:"hero(episode: \"JEDI\")"`
}
```

Then call `client.Query`:

```Go
err := client.Query(context.Background(), &q, nil)
if err != nil {
	// Handle error.
}
fmt.Println(q.Hero.Name)
fmt.Println(q.Hero.PrimaryFunction)
fmt.Println(q.Hero.Height)

// Output:
// R2-D2
// Astromech
// 0
```

### Specify GraphQL type name

The GraphQL type is automatically inferred from Go type by reflection. However, it's cumbersome in some use cases, e.g lowercase names. In Go, a type name with a first lowercase letter is considered private. If we need to reuse it for other packages, there are 2 approaches: type alias or implement `GetGraphQLType` method.

```go
type UserReviewInput struct {
	Review String
	UserID String
}

// type alias
type user_review_input UserReviewInput
// or implement GetGraphQLType method
func (u UserReviewInput) GetGraphQLType() string { return "user_review_input" }

variables := map[string]interface{}{
  "input": UserReviewInput{}
}

//query arguments without GetGraphQLType() defined
//($input: UserReviewInput!)
//query arguments with GetGraphQLType() defined:w
//($input: user_review_input!)
```

### Mutations

Mutations often require information that you can only find out by performing a query first. Let's suppose you've already done that.

For example, to make the following GraphQL mutation:

```GraphQL
mutation($ep: Episode!, $review: ReviewInput!) {
	createReview(episode: $ep, review: $review) {
		stars
		commentary
	}
}
variables {
	"ep": "JEDI",
	"review": {
		"stars": 5,
		"commentary": "This is a great movie!"
	}
}
```

You can define:

```Go
var m struct {
	CreateReview struct {
		Stars      graphql.Int
		Commentary graphql.String
	} `graphql:"createReview(episode: $ep, review: $review)"`
}
variables := map[string]interface{}{
	"ep": starwars.Episode("JEDI"),
	"review": starwars.ReviewInput{
		Stars:      graphql.Int(5),
		Commentary: graphql.String("This is a great movie!"),
	},
}
```

Then call `client.Mutate`:

```Go
err := client.Mutate(context.Background(), &m, variables)
if err != nil {
	// Handle error.
}
fmt.Printf("Created a %v star review: %v\n", m.CreateReview.Stars, m.CreateReview.Commentary)

// Output:
// Created a 5 star review: This is a great movie!
```

#### Mutations Without Fields

Sometimes, you don't need any fields returned from a mutation. Doing that is easy.

For example, to make the following GraphQL mutation:

```GraphQL
mutation($ep: Episode!, $review: ReviewInput!) {
	createReview(episode: $ep, review: $review)
}
variables {
	"ep": "JEDI",
	"review": {
		"stars": 5,
		"commentary": "This is a great movie!"
	}
}
```

You can define:

```Go
var m struct {
	CreateReview string `graphql:"createReview(episode: $ep, review: $review)"`
}
variables := map[string]interface{}{
	"ep": starwars.Episode("JEDI"),
	"review": starwars.ReviewInput{
		Stars:      graphql.Int(5),
		Commentary: graphql.String("This is a great movie!"),
	},
}
```

Then call `client.Mutate`:

```Go
err := client.Mutate(context.Background(), &m, variables)
if err != nil {
	// Handle error.
}
fmt.Printf("Created a review: %s.\n", m.CreateReview)

// Output:
// Created a review: .
```

### Execute

The `Exec` function allows you to executing pre-built queries. While using reflection to build queries is convenient as you get some resemblance of type safety, it gets very cumbersome when you need to create queries semi-dynamically. For instance, imagine you are building a CLI tool to query data from a graphql endpoint and you want users to be able to narrow down the query by passing cli flags or something.

```Go
// filters would be built dynamically somehow from the command line flags
filters := []string{
   `fieldA: {subfieldA: {_eq: "a"}}`,
   `fieldB: {_eq: "b"}`,
   ...
}

query := "query{something(where: {" + strings.Join(filters, ", ") + "}){id}}"
res := struct {
	Somethings []Something
}{}

if err := client.Exec(ctx, query, &res, map[string]any{}); err != nil {
	panic(err)
}
```

### Subscription

#### Usage

Construct a Subscription client, specifying the GraphQL server URL.

```Go
client := graphql.NewSubscriptionClient("wss://example.com/graphql")
defer client.Close()

// Subscribe subscriptions
// ...
// finally run the client
client.Run()
```

#### Subscribe

To make a GraphQL subscription, you need to define a corresponding Go type.

For example, to make the following GraphQL query:

```GraphQL
subscription {
	me {
		name
	}
}
```

You can define this variable:

```Go
var subscription struct {
	Me struct {
		Name graphql.String
	}
}
```

Then call `client.Subscribe`, passing a pointer to it:

```Go
subscriptionId, err := client.Subscribe(&query, nil, func(dataValue *json.RawMessage, errValue error) error {
	if errValue != nil {
		// handle error
		// if returns error, it will failback to `onError` event
		return nil
	}
	data := query{}
	err := json.Unmarshal(dataValue, &data)

	fmt.Println(query.Me.Name)

	// Output: Luke Skywalker
})

if err != nil {
	// Handle error.
}

// you can unsubscribe the subscription while the client is running
client.Unsubscribe(subscriptionId)
```

#### Authentication

The subscription client is authenticated with GraphQL server through connection params:

```Go
client := graphql.NewSubscriptionClient("wss://example.com/graphql").
	WithConnectionParams(map[string]interface{}{
		"headers": map[string]string{
				"authentication": "...",
		},
	})

```

#### Options

```Go
client.
	//  write timeout of websocket client
	WithTimeout(time.Minute). 
	// When the websocket server was stopped, the client will retry connecting every second until timeout
	WithRetryTimeout(time.Minute).
	// sets loging function to print out received messages. By default, nothing is printed
	WithLog(log.Println).
	// max size of response message
	WithReadLimit(10*1024*1024).
	// these operation event logs won't be printed
	WithoutLogTypes(graphql.GQL_DATA, graphql.GQL_CONNECTION_KEEP_ALIVE)

```

#### Events

```Go
// OnConnected event is triggered when the websocket connected to GraphQL server sucessfully
client.OnConnected(fn func())

// OnDisconnected event is triggered when the websocket server was stil down after retry timeout
client.OnDisconnected(fn func())

// OnConnected event is triggered when there is any connection error. This is bottom exception handler level
// If this function is empty, or returns nil, the error is ignored
// If returns error, the websocket connection will be terminated
client.OnError(onError func(sc *SubscriptionClient, err error) error)
```

#### Custom HTTP Client

Use `WithWebSocketOptions` to customize the HTTP client which is used by the subscription client.

```go
client.WithWebSocketOptions(WebsocketOptions{
	HTTPClient: &http.Client{
		Transport: http.DefaultTransport,
		Timeout: time.Minute,
	}
})
```

#### Custom WebSocket client

By default the subscription client uses [nhooyr WebSocket client](https://github.com/nhooyr/websocket). If you need to customize the client, or prefer using [Gorilla WebSocket](https://github.com/gorilla/websocket), let's follow the Websocket interface and replace the constructor with `WithWebSocket` method:

```go
// WebsocketHandler abstracts WebSocket connection functions
// ReadJSON and WriteJSON data of a frame from the WebSocket connection.
// Close the WebSocket connection.
type WebsocketConn interface {
	ReadJSON(v interface{}) error
	WriteJSON(v interface{}) error
	Close() error
	// SetReadLimit sets the maximum size in bytes for a message read from the peer. If a
	// message exceeds the limit, the connection sends a close message to the peer
	// and returns ErrReadLimit to the application.
	SetReadLimit(limit int64)
}

// WithWebSocket replaces customized websocket client constructor
func (sc *SubscriptionClient) WithWebSocket(fn func(sc *SubscriptionClient) (WebsocketConn, error)) *SubscriptionClient
```

**Example**

```Go

// the default websocket constructor
func newWebsocketConn(sc *SubscriptionClient) (WebsocketConn, error) {
	options := &websocket.DialOptions{
		Subprotocols: []string{"graphql-ws"},
	}
	c, _, err := websocket.Dial(sc.GetContext(), sc.GetURL(), options)
	if err != nil {
		return nil, err
	}

	// The default WebsocketHandler implementation using nhooyr's
	return &WebsocketHandler{
		ctx:     sc.GetContext(),
		Conn:    c,
		timeout: sc.GetTimeout(),
	}, nil
}

client := graphql.NewSubscriptionClient("wss://example.com/graphql")
defer client.Close()

client.WithWebSocket(newWebsocketConn)

client.Run()
```

### Options

There are extensible parts in the GraphQL query that we sometimes use. They are optional so that we shouldn't required them in the method. To make it flexible, we can abstract these options as optional arguments that follow this interface.

```go
type Option interface {
	Type() OptionType
	String() string
}

client.Query(ctx context.Context, q interface{}, variables map[string]interface{}, options ...Option) error
```

Currently we support 2 option types: `operation_name` and `operation_directive`. The operation name option is built-in because it is unique. We can use the option directly with `OperationName`

```go
// query MyQuery {
//	...
// }
client.Query(ctx, &q, variables, graphql.OperationName("MyQuery"))
```

In contrast, operation directive is various and customizable on different GraphQL servers. There isn't any built-in directive in the library. You need to define yourself. For example:

```go
// define @cached directive for Hasura queries
// https://hasura.io/docs/latest/graphql/cloud/response-caching.html#enable-caching
type cachedDirective struct {
	ttl int
}

func (cd cachedDirective) Type() OptionType {
	// operation_directive
	return graphql.OptionTypeOperationDirective
}

func (cd cachedDirective) String() string {
	if cd.ttl <= 0 {
		return "@cached"
	}
	return fmt.Sprintf("@cached(ttl: %d)", cd.ttl)
}

// query MyQuery @cached {
//	...
// }
client.Query(ctx, &q, variables, graphql.OperationName("MyQuery"), cachedDirective{})
```

### With operation name (deprecated)

Operation name is still on API decision plan https://github.com/shurcooL/graphql/issues/12. However, in my opinion separate methods are easier choice to avoid breaking changes

```Go
func (c *Client) NamedQuery(ctx context.Context, name string, q interface{}, variables map[string]interface{}) error

func (c *Client) NamedMutate(ctx context.Context, name string, q interface{}, variables map[string]interface{}) error

func (sc *SubscriptionClient) NamedSubscribe(name string, v interface{}, variables map[string]interface{}, handler func(message *json.RawMessage, err error) error) (string, error)
```

### Raw bytes response

In the case we developers want to decode JSON response ourself. Moreover, the default `UnmarshalGraphQL` function isn't ideal with complicated nested interfaces

```Go
func (c *Client) QueryRaw(ctx context.Context, q interface{}, variables map[string]interface{}) (*json.RawMessage, error)

func (c *Client) MutateRaw(ctx context.Context, q interface{}, variables map[string]interface{}) (*json.RawMessage, error)

func (c *Client) NamedQueryRaw(ctx context.Context, name string, q interface{}, variables map[string]interface{}) (*json.RawMessage, error)

func (c *Client) NamedMutateRaw(ctx context.Context, name string, q interface{}, variables map[string]interface{}) (*json.RawMessage, error)
```

### Multiple mutations with ordered map

You might need to make multiple mutations in single query. It's not very convenient with structs
so you can use ordered map `[][2]interface{}` instead.

For example, to make the following GraphQL mutation:

```GraphQL
mutation($login1: String!, $login2: String!, $login3: String!) {
	createUser(login: $login1) { login }
	createUser(login: $login2) { login }
	createUser(login: $login3) { login }
}
variables {
	"login1": "grihabor",
	"login2": "diman",
	"login3": "indigo"
}
```

You can define:

```Go
type CreateUser struct {
	Login graphql.String
}
m := [][2]interface{}{
	{"createUser(login: $login1)", &CreateUser{}},
	{"createUser(login: $login2)", &CreateUser{}},
	{"createUser(login: $login3)", &CreateUser{}},
}
variables := map[string]interface{}{
	"login1": graphql.String("grihabor"),
	"login2": graphql.String("diman"),
	"login3": graphql.String("indigo"),
}
```

### Debugging and Unit test

Enable debug mode with the `WithDebug` function. If the request is failed, the request and response information will be included in `extensions[].internal` property.

```json
{
	"errors": [
		{
			"message":"Field 'user' is missing required arguments: login",
			"extensions": {
				"internal": {
					"request": {
						"body":"{\"query\":\"{user{name}}\"}",
						"headers": {
							"Content-Type": ["application/json"]
						}
					},
					"response": {
						"body":"{\"errors\": [{\"message\": \"Field 'user' is missing required arguments: login\",\"locations\": [{\"line\": 7,\"column\": 3}]}]}",
						"headers": {
							"Content-Type": ["application/json"]
						}
					}
				}
			},
			"locations": [
				{
					"line":7,
					"column":3
				}
			]
		}
	]
}
```

Because the GraphQL query string is generated in runtime using reflection, it isn't really safe. To assure the GraphQL query is expected, it's necessary to write some unit test for query construction.

```go
// ConstructQuery build GraphQL query string from struct and variables
func ConstructQuery(v interface{}, variables map[string]interface{}, options ...Option) (string, error)

// ConstructQuery build GraphQL mutation string from struct and variables
func ConstructMutation(v interface{}, variables map[string]interface{}, options ...Option) (string, error)

// ConstructSubscription build GraphQL subscription string from struct and variables
func ConstructSubscription(v interface{}, variables map[string]interface{}, options ...Option) (string, error) 

// UnmarshalGraphQL parses the JSON-encoded GraphQL response data and stores
// the result in the GraphQL query data structure pointed to by v.
func UnmarshalGraphQL(data []byte, v interface{}) error 
```

Directories
-----------

| Path                                                                                   | Synopsis                                                                                                        |
|----------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| [example/graphqldev](https://godoc.org/github.com/shurcooL/graphql/example/graphqldev) | graphqldev is a test program currently being used for developing graphql package.                               |
| [ident](https://godoc.org/github.com/shurcooL/graphql/ident)                           | Package ident provides functions for parsing and converting identifier names between various naming convention. |
| [internal/jsonutil](https://godoc.org/github.com/shurcooL/graphql/internal/jsonutil)   | Package jsonutil provides a function for decoding JSON into a GraphQL query data structure.                     |

References
----------
- https://github.com/shurcooL/graphql
- https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md
- https://github.com/nhooyr/websocket


License
-------

-	[MIT License](LICENSE)
