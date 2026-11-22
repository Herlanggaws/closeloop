// Package polar talks to the billing provider (merchant of record) for paid plans.
// The provider's name must never reach user-facing copy or API error messages.
package polar

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	IntervalMonth = "month"
	IntervalYear  = "year"

	MetadataOrgID = "org_id"
)

var (
	ErrNotConfigured = errors.New("billing not configured")
	ErrNoCustomer    = errors.New("no billing customer")
)

// BaseURL maps POLAR_SERVER to the API host. An unknown value gives "" so a typo
// turns billing off instead of sending live customers to the sandbox.
func BaseURL(server string) string {
	switch strings.ToLower(strings.TrimSpace(server)) {
	case "", "sandbox":
		return "https://sandbox-api.polar.sh"
	case "production":
		return "https://api.polar.sh"
	default:
		return ""
	}
}

// Products holds the provider's product ID for each sellable plan and interval.
type Products struct {
	IndieMonthly  string
	IndieYearly   string
	StudioMonthly string
	StudioYearly  string
}

type product struct {
	id, plan, interval string
}

func (p Products) all() []product {
	return []product{
		{p.IndieMonthly, "indie", IntervalMonth},
		{p.IndieYearly, "indie", IntervalYear},
		{p.StudioMonthly, "studio", IntervalMonth},
		{p.StudioYearly, "studio", IntervalYear},
	}
}

// Complete reports whether every product ID is set.
func (p Products) Complete() bool {
	for _, item := range p.all() {
		if item.id == "" {
			return false
		}
	}
	return true
}

// ID returns the product for a plan and interval.
func (p Products) ID(plan, interval string) (string, bool) {
	for _, item := range p.all() {
		if item.plan == plan && item.interval == interval {
			return item.id, true
		}
	}
	return "", false
}

// Lookup is the reverse of ID.
func (p Products) Lookup(id string) (plan, interval string, ok bool) {
	for _, item := range p.all() {
		if id != "" && item.id == id {
			return item.plan, item.interval, true
		}
	}
	return "", "", false
}

type Client struct {
	Base  string
	Token string
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

func (c Client) Enabled() bool { return c.Base != "" && c.Token != "" }

type Checkout struct {
	ProductID string
	OrgID     string
	Email     string
	// SuccessURL is where the buyer lands after paying, ReturnURL where Back goes.
	SuccessURL string
	ReturnURL  string
}

// CreateCheckout returns the hosted checkout URL.
func (c Client) CreateCheckout(ctx context.Context, in Checkout) (string, error) {
	if !c.Enabled() {
		return "", ErrNotConfigured
	}
	var out struct {
		URL string `json:"url"`
	}
	body := map[string]any{
		"products":             []string{in.ProductID},
		"customer_email":       in.Email,
		"external_customer_id": in.OrgID,
		// Copied onto the subscription. external_customer_id alone is not enough: it is
		// ignored when the buyer's email already belongs to a customer.
		"metadata":    map[string]string{MetadataOrgID: in.OrgID},
		"success_url": in.SuccessURL,
		"return_url":  in.ReturnURL,
	}
	const path = "/v1/checkouts/"
	err := c.post(ctx, path, body, &out)
	var apiErr *APIError
	if errors.As(err, &apiErr) && apiErr.rejected("customer_email") {
		// Undeliverable addresses are refused. Open checkout without one and the buyer types it there.
		delete(body, "customer_email")
		err = c.post(ctx, path, body, &out)
	}
	if err != nil {
		return "", err
	}
	return hostedURL(out.URL)
}

// CreatePortalSession returns a customer portal URL. It looks the customer up by org
// ID only: the checkout email is buyer-editable, so a customer ID learned from a
// webhook could belong to someone else and would expose their invoices.
func (c Client) CreatePortalSession(ctx context.Context, orgID, returnURL string) (string, error) {
	if !c.Enabled() {
		return "", ErrNotConfigured
	}
	var out struct {
		URL string `json:"customer_portal_url"`
	}
	err := c.post(ctx, "/v1/customer-sessions/", map[string]any{
		"external_customer_id": orgID,
		"return_url":           returnURL,
	}, &out)
	var apiErr *APIError
	if errors.As(err, &apiErr) && apiErr.customerMissing() {
		return "", ErrNoCustomer
	}
	if err != nil {
		return "", err
	}
	return hostedURL(out.URL)
}

// APIError is a non-2xx answer. Only the status, error type and rejected field names
// are kept: the rest of the body can echo customer details, and this gets logged.
type APIError struct {
	Path   string
	Status int
	Type   string
	Fields []string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("billing API %s: status %d %s %v", e.Path, e.Status, e.Type, e.Fields)
}

func (e *APIError) customerMissing() bool {
	if e.Status == http.StatusNotFound {
		return true
	}
	return e.rejected("external_customer_id")
}

// rejected reports whether validation refused the given request field.
func (e *APIError) rejected(field string) bool {
	if e.Status != http.StatusUnprocessableEntity {
		return false
	}
	for _, f := range e.Fields {
		if f == field || strings.HasSuffix(f, "."+field) {
			return true
		}
	}
	return false
}

func (c Client) post(ctx context.Context, path string, in, out any) error {
	raw, err := json.Marshal(in)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(c.Base, "/")+path, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	res, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("billing API %s: %w", path, err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return apiError(path, res)
	}
	if err := json.NewDecoder(res.Body).Decode(out); err != nil {
		return fmt.Errorf("billing API %s: decode: %w", path, err)
	}
	return nil
}

func apiError(path string, res *http.Response) error {
	e := &APIError{Path: path, Status: res.StatusCode}
	var body struct {
		Error  string          `json:"error"`
		Detail json.RawMessage `json:"detail"`
	}
	// The body is only extra detail for the log; the status is the error.
	if json.NewDecoder(res.Body).Decode(&body) != nil {
		return e
	}
	e.Type = body.Error
	var details []struct {
		Loc []any `json:"loc"`
	}
	if json.Unmarshal(body.Detail, &details) == nil { // detail is a plain string on 4xx other than 422
		for _, d := range details {
			parts := make([]string, 0, len(d.Loc))
			for _, l := range d.Loc {
				parts = append(parts, fmt.Sprint(l))
			}
			e.Fields = append(e.Fields, strings.Join(parts, "."))
		}
	}
	return e
}

func hostedURL(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") {
		return "", errors.New("billing API returned no usable URL")
	}
	return raw, nil
}
