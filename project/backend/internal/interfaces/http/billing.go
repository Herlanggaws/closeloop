package httpapi

import (
	"errors"
	"log/slog"
	"strings"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/infrastructure/polar"
	"github.com/gin-gonic/gin"
)

// M5 billing (D-10). Responses say "billing" and never name the provider.

const billingUnavailable = "Billing is temporarily unavailable. Try again in a moment."

func (s *Server) billingClient() polar.Client {
	return polar.Client{Base: s.Cfg.PolarAPIBase, Token: s.Cfg.PolarAccessToken}
}

// checkoutEnabled needs the webhook secret too: without it we would take money and
// never switch the plan on.
func (s *Server) checkoutEnabled() bool {
	return s.billingClient().Enabled() && s.Cfg.PolarWebhookSecret != "" && s.Cfg.PolarProducts.Complete()
}

// paidPlanNeedsCheckout closes the manual plan switch once billing has a token, even
// if the rest of the config is broken, so a typo cannot make paid plans free.
func (s *Server) paidPlanNeedsCheckout(currentPlan, requested string) bool {
	if s.Cfg.PolarAccessToken == "" || !application.ValidPlan(requested) {
		return false
	}
	next := application.NormalizePlan(requested)
	return next != "free" && next != application.NormalizePlan(currentPlan) && application.SelfServePlanAllowed(next)
}

func writeBillingNotConfigured(c *gin.Context) {
	writeErr(c, 503, "BILLING_NOT_CONFIGURED", "Billing not configured on this server.")
}

func writeAlreadySubscribed(c *gin.Context) {
	writeErr(c, 409, "ALREADY_SUBSCRIBED", "You're already subscribed. Use Manage subscription to change or cancel your plan.")
}

func (s *Server) createBillingCheckout(c *gin.Context) {
	org, ok := s.requireOrgOwner(c)
	if !ok {
		return
	}
	var body struct {
		Plan     string `json:"plan"`
		Interval string `json:"interval"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	product, ok := s.Cfg.PolarProducts.ID(strings.TrimSpace(body.Plan), strings.TrimSpace(body.Interval))
	if !ok {
		writeErr(c, 400, "INVALID_INPUT", "plan must be indie or studio and interval month or year")
		return
	}
	if !s.checkoutEnabled() {
		writeBillingNotConfigured(c)
		return
	}
	if application.NormalizePlan(org.Plan) == "business" {
		writeErr(c, 409, "CONFLICT", "Business billing is handled by support. Contact us to change plans.")
		return
	}
	subscribed, err := s.Store.OrgSubscribed(c.Request.Context(), org.ID)
	if err != nil {
		mapErr(c, err)
		return
	}
	if subscribed {
		writeAlreadySubscribed(c)
		return
	}
	checkoutURL, err := s.billingClient().CreateCheckout(c.Request.Context(), polar.Checkout{
		ProductID:  product,
		OrgID:      org.ID,
		Email:      c.GetString("email"),
		SuccessURL: s.upgradeURL() + "?checkout=success",
		ReturnURL:  s.upgradeURL(),
	})
	if err != nil {
		slog.Error("billing checkout failed", "org_id", org.ID, "err", err)
		writeErr(c, 502, "BILLING_ERROR", billingUnavailable)
		return
	}
	s.writeAudit(c, org.ID, "", "billing.checkout_started", org.ID, map[string]any{
		"plan": body.Plan, "interval": body.Interval,
	})
	c.JSON(200, gin.H{"url": checkoutURL})
}

func (s *Server) createBillingPortal(c *gin.Context) {
	org, ok := s.requireOrgOwner(c)
	if !ok {
		return
	}
	client := s.billingClient()
	if !client.Enabled() {
		writeBillingNotConfigured(c)
		return
	}
	portalURL, err := client.CreatePortalSession(c.Request.Context(), org.ID, s.upgradeURL())
	switch {
	case errors.Is(err, polar.ErrNoCustomer):
		writeErr(c, 409, "NO_BILLING_ACCOUNT", "We couldn't open billing for this workspace. Contact support to manage your subscription.")
	case err != nil:
		slog.Error("billing portal failed", "org_id", org.ID, "err", err)
		writeErr(c, 502, "BILLING_ERROR", billingUnavailable)
	default:
		c.JSON(200, gin.H{"url": portalURL})
	}
}
