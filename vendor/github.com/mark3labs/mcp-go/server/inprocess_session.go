package server

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

// SamplingHandler defines the interface for handling sampling requests from servers.
type SamplingHandler interface {
	CreateMessage(ctx context.Context, request mcp.CreateMessageRequest) (*mcp.CreateMessageResult, error)
}

// ElicitationHandler defines the interface for handling elicitation requests from servers.
type ElicitationHandler interface {
	Elicit(ctx context.Context, request mcp.ElicitationRequest) (*mcp.ElicitationResult, error)
}

// RootsHandler defines the interface for handling roots list requests from servers.
type RootsHandler interface {
	ListRoots(ctx context.Context, request mcp.ListRootsRequest) (*mcp.ListRootsResult, error)
}

type InProcessSession struct {
	clientInfoStore // provides Get/SetClientInfo and Get/SetClientCapabilities via method promotion

	sessionID          string
	notifications      chan mcp.JSONRPCNotification
	initialized        atomic.Bool
	loggingLevel       atomic.Value
	samplingHandler    SamplingHandler
	elicitationHandler ElicitationHandler
	rootsHandler       RootsHandler
	mu                 sync.RWMutex
}

func NewInProcessSession(sessionID string, samplingHandler SamplingHandler) *InProcessSession {
	return &InProcessSession{
		sessionID:       sessionID,
		notifications:   make(chan mcp.JSONRPCNotification, 100),
		samplingHandler: samplingHandler,
	}
}

func NewInProcessSessionWithHandlers(sessionID string, samplingHandler SamplingHandler, elicitationHandler ElicitationHandler, rootsHandler RootsHandler) *InProcessSession {
	return &InProcessSession{
		sessionID:          sessionID,
		notifications:      make(chan mcp.JSONRPCNotification, 100),
		samplingHandler:    samplingHandler,
		elicitationHandler: elicitationHandler,
		rootsHandler:       rootsHandler,
	}
}

// isInProcess marks this session as dispatching server-initiated requests as
// direct in-process function calls rather than protocol messages, which is why
// they remain available on connections using protocol version 2026-07-28 or
// later.
func (s *InProcessSession) isInProcess() {}

func (s *InProcessSession) SessionID() string {
	return s.sessionID
}

func (s *InProcessSession) NotificationChannel() chan<- mcp.JSONRPCNotification {
	return s.notifications
}

// ClientNotifications returns the receive-only endpoint of the session's
// notification channel. In-process transports use this to drain
// server-to-client notifications (progress, list-changed, resource
// updates, etc.) queued via NotificationChannel and forward them to the
// client's registered notification handler.
func (s *InProcessSession) ClientNotifications() <-chan mcp.JSONRPCNotification {
	return s.notifications
}

func (s *InProcessSession) Initialize() {
	s.loggingLevel.Store(mcp.LoggingLevelError)
	s.initialized.Store(true)
}

func (s *InProcessSession) Initialized() bool {
	return s.initialized.Load()
}

func (s *InProcessSession) SetLogLevel(level mcp.LoggingLevel) {
	s.loggingLevel.Store(level)
}

func (s *InProcessSession) GetLogLevel() mcp.LoggingLevel {
	level := s.loggingLevel.Load()
	if level == nil {
		return mcp.LoggingLevelError
	}
	return level.(mcp.LoggingLevel)
}

func (s *InProcessSession) RequestSampling(ctx context.Context, request mcp.CreateMessageRequest) (*mcp.CreateMessageResult, error) {
	s.mu.RLock()
	handler := s.samplingHandler
	s.mu.RUnlock()

	if handler == nil {
		return nil, fmt.Errorf("no sampling handler available")
	}

	return handler.CreateMessage(ctx, request)
}

func (s *InProcessSession) RequestElicitation(ctx context.Context, request mcp.ElicitationRequest) (*mcp.ElicitationResult, error) {
	s.mu.RLock()
	handler := s.elicitationHandler
	s.mu.RUnlock()

	if handler == nil {
		return nil, fmt.Errorf("no elicitation handler available")
	}

	return handler.Elicit(ctx, request)
}

// ListRoots sends a list roots request to the client and waits for the response.
// Returns an error if no roots handler is available.
func (s *InProcessSession) ListRoots(ctx context.Context, request mcp.ListRootsRequest) (*mcp.ListRootsResult, error) {
	s.mu.RLock()
	handler := s.rootsHandler
	s.mu.RUnlock()

	if handler == nil {
		return nil, fmt.Errorf("no roots handler available")
	}

	return handler.ListRoots(ctx, request)
}

// inProcessSessionCounter numbers in-process sessions: the wall clock alone
// repeats, as it moves in microseconds on some platforms.
var inProcessSessionCounter atomic.Uint64

// GenerateInProcessSessionID generates a unique session ID for inprocess clients
func GenerateInProcessSessionID() string {
	return fmt.Sprintf("inprocess-%d-%d", time.Now().UnixNano(), inProcessSessionCounter.Add(1))
}

// Ensure interface compliance
var (
	_ ClientSession          = (*InProcessSession)(nil)
	_ SessionWithLogging     = (*InProcessSession)(nil)
	_ SessionWithClientInfo  = (*InProcessSession)(nil)
	_ SessionWithSampling    = (*InProcessSession)(nil)
	_ SessionWithElicitation = (*InProcessSession)(nil)
	_ SessionWithRoots       = (*InProcessSession)(nil)
)
