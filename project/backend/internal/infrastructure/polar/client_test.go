package polar

import "testing"

func TestBaseURL(t *testing.T) {
	cases := map[string]string{
		"":            "https://sandbox-api.polar.sh",
		"sandbox":     "https://sandbox-api.polar.sh",
		" Production": "https://api.polar.sh",
		"prod":        "",
	}
	for in, want := range cases {
		if got := BaseURL(in); got != want {
			t.Fatalf("BaseURL(%q)=%q want %q", in, got, want)
		}
	}
}

func TestProductsMapBothWays(t *testing.T) {
	p := Products{IndieMonthly: "im", IndieYearly: "iy", StudioMonthly: "sm", StudioYearly: "sy"}
	cases := []struct{ id, plan, interval string }{
		{"im", "indie", IntervalMonth},
		{"iy", "indie", IntervalYear},
		{"sm", "studio", IntervalMonth},
		{"sy", "studio", IntervalYear},
	}
	for _, tc := range cases {
		if id, ok := p.ID(tc.plan, tc.interval); !ok || id != tc.id {
			t.Fatalf("ID(%s,%s)=%q,%v want %q", tc.plan, tc.interval, id, ok, tc.id)
		}
		if plan, interval, ok := p.Lookup(tc.id); !ok || plan != tc.plan || interval != tc.interval {
			t.Fatalf("Lookup(%s)=%s,%s,%v", tc.id, plan, interval, ok)
		}
	}
	if _, ok := p.ID("business", IntervalMonth); ok {
		t.Fatal("Business must not be sellable")
	}
	if _, _, ok := p.Lookup("other"); ok {
		t.Fatal("unknown product must not map to a plan")
	}
	if _, _, ok := (Products{}).Lookup(""); ok {
		t.Fatal("an unset product must not match an empty id")
	}
	if !p.Complete() {
		t.Fatal("all four ids set should be complete")
	}
	p.StudioYearly = ""
	if p.Complete() {
		t.Fatal("a missing id is not complete")
	}
}
