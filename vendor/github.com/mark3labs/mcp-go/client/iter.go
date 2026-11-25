package client

import (
	"context"
	"iter"

	"github.com/mark3labs/mcp-go/mcp"
)

// IterTools returns an iterator that lazily fetches pages of tools from the
// server. Each iteration starts from the cursor in the original request.
// Pages are fetched on demand as the iterator is consumed; breaking out of the
// loop stops further requests.
//
// If an error occurs while fetching a page, the iterator yields a single
// (zero-value, error) pair and then stops.
//
// Example:
//
//	for tool, err := range client.IterTools(ctx, mcp.ListToolsRequest{}) {
//	    if err != nil {
//	        return err
//	    }
//	    fmt.Println(tool.Name)
//	}
func (c *Client) IterTools(
	ctx context.Context,
	request mcp.ListToolsRequest,
) iter.Seq2[mcp.Tool, error] {
	return func(yield func(mcp.Tool, error) bool) {
		request := request
		seen := map[mcp.Cursor]struct{}{request.Params.Cursor: {}}
		for {
			if err := ctx.Err(); err != nil {
				yield(mcp.Tool{}, err)
				return
			}
			result, err := c.ListToolsByPage(ctx, request)
			if err != nil {
				yield(mcp.Tool{}, err)
				return
			}
			for _, tool := range result.Tools {
				if !yield(tool, nil) {
					return
				}
			}
			if result.NextCursor == "" {
				return
			}
			if err := noteListCursor(seen, result.NextCursor); err != nil {
				yield(mcp.Tool{}, err)
				return
			}
			request.Params.Cursor = result.NextCursor
		}
	}
}

// IterResources returns an iterator that lazily fetches pages of resources
// from the server. Each iteration starts from the cursor in the original
// request. Pages are fetched on demand as the iterator is consumed; breaking
// out of the loop stops further requests.
//
// If an error occurs while fetching a page, the iterator yields a single
// (zero-value, error) pair and then stops.
func (c *Client) IterResources(
	ctx context.Context,
	request mcp.ListResourcesRequest,
) iter.Seq2[mcp.Resource, error] {
	return func(yield func(mcp.Resource, error) bool) {
		request := request
		seen := map[mcp.Cursor]struct{}{request.Params.Cursor: {}}
		for {
			if err := ctx.Err(); err != nil {
				yield(mcp.Resource{}, err)
				return
			}
			result, err := c.ListResourcesByPage(ctx, request)
			if err != nil {
				yield(mcp.Resource{}, err)
				return
			}
			for _, resource := range result.Resources {
				if !yield(resource, nil) {
					return
				}
			}
			if result.NextCursor == "" {
				return
			}
			if err := noteListCursor(seen, result.NextCursor); err != nil {
				yield(mcp.Resource{}, err)
				return
			}
			request.Params.Cursor = result.NextCursor
		}
	}
}

// IterResourceTemplates returns an iterator that lazily fetches pages of
// resource templates from the server. Each iteration starts from the cursor in
// the original request. Pages are fetched on demand as the iterator is
// consumed; breaking out of the loop stops further requests.
//
// If an error occurs while fetching a page, the iterator yields a single
// (zero-value, error) pair and then stops.
func (c *Client) IterResourceTemplates(
	ctx context.Context,
	request mcp.ListResourceTemplatesRequest,
) iter.Seq2[mcp.ResourceTemplate, error] {
	return func(yield func(mcp.ResourceTemplate, error) bool) {
		request := request
		seen := map[mcp.Cursor]struct{}{request.Params.Cursor: {}}
		for {
			if err := ctx.Err(); err != nil {
				yield(mcp.ResourceTemplate{}, err)
				return
			}
			result, err := c.ListResourceTemplatesByPage(ctx, request)
			if err != nil {
				yield(mcp.ResourceTemplate{}, err)
				return
			}
			for _, template := range result.ResourceTemplates {
				if !yield(template, nil) {
					return
				}
			}
			if result.NextCursor == "" {
				return
			}
			if err := noteListCursor(seen, result.NextCursor); err != nil {
				yield(mcp.ResourceTemplate{}, err)
				return
			}
			request.Params.Cursor = result.NextCursor
		}
	}
}

// IterPrompts returns an iterator that lazily fetches pages of prompts from
// the server. Each iteration starts from the cursor in the original request.
// Pages are fetched on demand as the iterator is consumed; breaking out of the
// loop stops further requests.
//
// If an error occurs while fetching a page, the iterator yields a single
// (zero-value, error) pair and then stops.
func (c *Client) IterPrompts(
	ctx context.Context,
	request mcp.ListPromptsRequest,
) iter.Seq2[mcp.Prompt, error] {
	return func(yield func(mcp.Prompt, error) bool) {
		request := request
		seen := map[mcp.Cursor]struct{}{request.Params.Cursor: {}}
		for {
			if err := ctx.Err(); err != nil {
				yield(mcp.Prompt{}, err)
				return
			}
			result, err := c.ListPromptsByPage(ctx, request)
			if err != nil {
				yield(mcp.Prompt{}, err)
				return
			}
			for _, prompt := range result.Prompts {
				if !yield(prompt, nil) {
					return
				}
			}
			if result.NextCursor == "" {
				return
			}
			if err := noteListCursor(seen, result.NextCursor); err != nil {
				yield(mcp.Prompt{}, err)
				return
			}
			request.Params.Cursor = result.NextCursor
		}
	}
}
