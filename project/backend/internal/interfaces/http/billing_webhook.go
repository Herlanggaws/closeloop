package httpapi

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/infrastructure/polar"
	"github.com/gin-gonic/gin"
)

const billingWebhookMaxBody = 1 << 20

// billingWebhook is public; the signature is the authentication. The provider retries
// any non-2xx and disables the endpoint after 10 failures in a row, so events we do
// not care about still get a 202.
func (s *Server) billingWebhook(c *gin.Context) {
	if s.Cfg.PolarWebhookSecret == "" {
		writeBillingNotConfigured(c)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, billingWebhookMaxBody))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeErr(c, 413, "INVALID_INPUT", "payload too large")
			return
		}
		writeErr(c, 400, "INVALID_INPUT", "could not read body")
		return
	}
	eventID, err := polar.VerifyWebhook(s.Cfg.PolarWebhookSecret, c.Request.Header, body, time.Now())
	if err != nil {
		slog.Warn("billing webhook rejected", "err", err)
		writeErr(c, 403, "INVALID_SIGNATURE", "invalid signature")
		return
	}
	event, err := polar.ParseSubscriptionEvent(body)
	if err != nil {
		slog.Error("billing webhook unreadable", "event_id", eventID, "err", err)
		writeErr(c, 400, "INVALID_INPUT", "invalid event")
		return
	}
	if event == nil {
		c.JSON(202, gin.H{"ok": true})
		return
	}

	plan, interval, _ := s.Cfg.PolarProducts.Lookup(event.ProductID) // unmapped is handled by the store
	result, err := s.Store.ApplySubscriptionUpdate(c.Request.Context(), application.SubscriptionUpdate{
		EventID:           eventID,
		EventType:         event.Type,
		Revoked:           event.Type == "subscription.revoked",
		SubscriptionID:    event.SubscriptionID,
		OrgID:             event.OrgID,
		CustomerID:        event.CustomerID,
		ProductID:         event.ProductID,
		Plan:              plan,
		Interval:          interval,
		Status:            event.Status,
		CancelAtPeriodEnd: event.CancelAtPeriodEnd,
		CurrentPeriodEnd:  event.CurrentPeriodEnd,
		UpdatedAt:         event.UpdatedAt,
	})
	if err != nil {
		slog.Error("billing webhook failed", "event_id", eventID, "type", event.Type,
			"subscription_id", event.SubscriptionID, "product_id", event.ProductID, "err", err)
		writeErr(c, 500, "INTERNAL", "could not process event")
		return
	}
	slog.Info("billing webhook handled", "event_id", eventID, "type", event.Type,
		"subscription_id", event.SubscriptionID, "org_id", result.OrgID, "applied", result.Applied)
	if result.Plan != result.PreviousPlan {
		s.writeAudit(c, result.OrgID, "system:billing", "org.plan_changed", result.OrgID, map[string]any{
			"from": result.PreviousPlan, "to": result.Plan, "via": event.Type,
		})
	}
	c.JSON(202, gin.H{"ok": true})
}
