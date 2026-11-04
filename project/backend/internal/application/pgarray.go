package application

import (
	"database/sql/driver"
	"fmt"
	"strings"
)

type StringArray []string

func (a *StringArray) Scan(src any) error {
	switch v := src.(type) {
	case []byte:
		return a.parse(string(v))
	case string:
		return a.parse(v)
	case nil:
		*a = StringArray{}
		return nil
	default:
		return fmt.Errorf("unsupported array type %T", src)
	}
}

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return "{}", nil
	}
	parts := make([]string, len(a))
	for i, s := range a {
		parts[i] = `"` + strings.ReplaceAll(s, `"`, `\"`) + `"`
	}
	return "{" + strings.Join(parts, ",") + "}", nil
}

func (a *StringArray) parse(s string) error {
	s = strings.TrimSpace(s)
	if s == "{}" || s == "" {
		*a = StringArray{}
		return nil
	}
	s = strings.TrimPrefix(strings.TrimSuffix(s, "}"), "{")
	parts := splitPGArray(s)
	out := make(StringArray, 0, len(parts))
	for _, p := range parts {
		out = append(out, strings.Trim(p, `"`))
	}
	*a = out
	return nil
}

func splitPGArray(s string) []string {
	var parts []string
	var cur strings.Builder
	inQuotes := false
	escape := false
	for _, r := range s {
		if escape {
			cur.WriteRune(r)
			escape = false
			continue
		}
		if r == '\\' {
			escape = true
			continue
		}
		if r == '"' {
			inQuotes = !inQuotes
			continue
		}
		if r == ',' && !inQuotes {
			parts = append(parts, cur.String())
			cur.Reset()
			continue
		}
		cur.WriteRune(r)
	}
	parts = append(parts, cur.String())
	return parts
}

func asArray(v []string) StringArray {
	if v == nil {
		return StringArray{}
	}
	return StringArray(v)
}
