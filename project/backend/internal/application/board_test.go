package application

import "testing"

func TestNormalizeBoardSlug(t *testing.T) {
	ok, err := NormalizeBoardSlug("Bear-Budget")
	if err != nil || ok != "bear-budget" {
		t.Fatalf("got %q %v", ok, err)
	}
	if _, err := NormalizeBoardSlug("ab"); err == nil {
		t.Fatal("expected short slug invalid")
	}
	if _, err := NormalizeBoardSlug("Bad_Slug"); err == nil {
		t.Fatal("expected underscore invalid")
	}
}

func TestSlugifyBoardName(t *testing.T) {
	if got := SlugifyBoardName("Bear Budget Web!"); got != "bear-budget-web" {
		t.Fatalf("got %q", got)
	}
	if got := SlugifyBoardName("!!!"); got != "board" {
		t.Fatalf("got %q", got)
	}
}
