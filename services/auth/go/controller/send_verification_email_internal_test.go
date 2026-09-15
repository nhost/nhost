package controller

import (
	"testing"
	"time"

	"github.com/nhost/nhost/services/auth/go/sql"
)

func TestReusableVerificationTicket(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 13, 18, 23, 30, 0, time.UTC)

	const ticket = "verifyEmail:55fa0d55-631c-490a-a744-b5feca4c22a1"

	// Tickets are stored with their expiry, not their last-send time. Mint and
	// refresh paths write a literal 30-day TTL from that point.
	sent := func(ago time.Duration) sql.AuthUser {
		return sql.AuthUser{
			Ticket:          sql.Text(ticket),
			TicketExpiresAt: sql.TimestampTz(now.Add(-ago).Add(30 * 24 * time.Hour)),
		}
	}

	cases := []struct {
		name        string
		user        sql.AuthUser
		expected    string
		expectedOK  bool
		explanation string
	}{
		{
			name:        "just sent",
			user:        sent(0),
			expected:    ticket,
			expectedOK:  true,
			explanation: "a resend moments later must not invalidate the first email",
		},
		{
			name:        "sent just inside the window",
			user:        sent(VerificationTicketReuseWindow - time.Second),
			expected:    ticket,
			expectedOK:  true,
			explanation: "still within the window, so the delivered link stays valid",
		},
		{
			name:        "sent just outside the window",
			user:        sent(VerificationTicketReuseWindow + time.Second),
			expected:    "",
			expectedOK:  false,
			explanation: "past the window the ticket is rotated as before",
		},
		{
			name: "expiry implies future send",
			user: sql.AuthUser{
				Ticket:          sql.Text(ticket),
				TicketExpiresAt: sql.TimestampTz(now.Add(60 * 24 * time.Hour)),
			},
			expected:    "",
			expectedOK:  false,
			explanation: "a longer-than-expected TTL must rotate instead of bypassing the reuse window",
		},
		{
			name: "expiry implies old send",
			user: sql.AuthUser{
				Ticket:          sql.Text(ticket),
				TicketExpiresAt: sql.TimestampTz(now.Add(7 * 24 * time.Hour)),
			},
			expected:    "",
			expectedOK:  false,
			explanation: "a shorter-than-expected TTL must rotate instead of reusing an old ticket",
		},
		{
			name: "password reset ticket",
			user: sql.AuthUser{
				Ticket:          sql.Text("passwordReset:55fa0d55-631c-490a-a744-b5feca4c22a1"),
				TicketExpiresAt: sql.TimestampTz(now.Add(30 * 24 * time.Hour)),
			},
			expected:    "",
			expectedOK:  false,
			explanation: "the ticket column is shared; reusing another flow's ticket would fail the type check in verifyTicket",
		},
		{
			name: "mfa challenge ticket",
			user: sql.AuthUser{
				Ticket:          sql.Text("mfaTotp:55fa0d55-631c-490a-a744-b5feca4c22a1"),
				TicketExpiresAt: sql.TimestampTz(now.Add(In5Minutes)),
			},
			expected:    "",
			expectedOK:  false,
			explanation: "an MFA challenge uses a different TTL, so its issued-at cannot be derived",
		},
		{
			name:        "no ticket",
			user:        sql.AuthUser{},
			expected:    "",
			expectedOK:  false,
			explanation: "nothing to reuse",
		},
		{
			name: "ticket without expiry",
			user: sql.AuthUser{
				Ticket: sql.Text(ticket),
			},
			expected:    "",
			expectedOK:  false,
			explanation: "issued-at is derived from the expiry, so an absent expiry is unusable",
		},
		{
			name: "expired ticket",
			user: sql.AuthUser{
				Ticket:          sql.Text(ticket),
				TicketExpiresAt: sql.TimestampTz(now.Add(-time.Hour)),
			},
			expected:    "",
			expectedOK:  false,
			explanation: "an expired ticket would produce a link that cannot be redeemed",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, ok := reusableVerificationTicket(tc.user, now)

			if ok != tc.expectedOK {
				t.Errorf("reuse = %v, want %v (%s)", ok, tc.expectedOK, tc.explanation)
			}

			if got != tc.expected {
				t.Errorf("ticket = %q, want %q", got, tc.expected)
			}
		})
	}
}
