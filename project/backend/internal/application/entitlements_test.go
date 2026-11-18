package application

import "testing"

func TestReplayAllowedAndRetention(t *testing.T) {
	cases := []struct {
		plan      string
		allowed   bool
		retention int
	}{
		{"free", false, 0},
		{"indie", false, 0},
		{"studio", true, 7},
		{"business", true, 30},
		{"STUDIO", true, 7},
	}
	for _, tc := range cases {
		if got := ReplayAllowed(tc.plan); got != tc.allowed {
			t.Fatalf("ReplayAllowed(%q)=%v want %v", tc.plan, got, tc.allowed)
		}
		if got := ReplayRetentionDays(tc.plan); got != tc.retention {
			t.Fatalf("ReplayRetentionDays(%q)=%d want %d", tc.plan, got, tc.retention)
		}
	}
}
