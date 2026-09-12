// Tests for the parts of the generator that decide what a fixture means
// and what Go actually said — the two places it can be wrong in a way the
// corpus would then enforce on the engine forever.
package main

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// A real error string from Go 1.25.7, not an approximation of one: the
// whole job of goErrorCore is to survive this exact shape.
const realExecError = `template: negative-arity-upper-too-many:1:3: ` +
	`executing "negative-arity-upper-too-many" at <upper>: ` +
	`wrong number of args for upper: want 1 got 2`

func TestGoErrorCoreStripsTheWrapper(t *testing.T) {
	core, err := goErrorCore("negative-arity-upper-too-many", errors.New(realExecError))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// The core keeps its own colon-space; only the wrapper is removed.
	if want := "wrong number of args for upper: want 1 got 2"; core != want {
		t.Errorf("core = %q, want %q", core, want)
	}
}

func TestGoErrorCoreRefusesToGuess(t *testing.T) {
	// The node text carries a second ">: ", so the boundary is ambiguous.
	// Neither the first nor the last occurrence is right in general, and
	// the wrong pick would be written out as Go's message without complaint.
	ambiguous := `template: negative-arity-trim-too-many:1:3: ` +
		`executing "negative-arity-trim-too-many" at <trim ">: oops">: ` +
		`wrong number of args for trim: want 1 got 2`

	for _, tc := range []struct {
		name string
		fn   string
		text string
	}{
		{"ambiguous context end", "negative-arity-trim-too-many", ambiguous},
		{"no context marker at all", "somefixture", "template: somefixture: some other failure"},
		{"context never closed", "somefixture", `template: somefixture:1:3: executing "somefixture" at <upper`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			core, err := goErrorCore(tc.fn, errors.New(tc.text))
			if err == nil {
				t.Fatalf("expected a refusal, got core %q", core)
			}
			// The message has to carry the text that confused it, or the
			// maintainer cannot see what to fix. It is quoted into the
			// error, so that is the form to look for.
			if !strings.Contains(err.Error(), strconv.Quote(tc.text)) {
				t.Errorf("error %q does not quote the offending text", err)
			}
		})
	}
}

func writeFixture(t *testing.T, files ...string) string {
	t.Helper()
	dir := t.TempDir()
	for _, name := range files {
		if err := os.WriteFile(filepath.Join(dir, name), nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func TestDeclaredOutcome(t *testing.T) {
	for _, tc := range []struct {
		name  string
		files []string
		want  outcome
	}{
		// A render fixture is authored as a bare template.tmpl; its
		// outcome file does not exist until the generator writes one.
		{"nothing declared is a render fixture", nil, outcomeRender},
		{"expected.txt", []string{"expected.txt"}, outcomeRender},
		{"expected-go-error.txt", []string{"expected-go-error.txt"}, outcomeRefusal},
		{"expected-fragments.json", []string{"expected-fragments.json"}, outcomeJSOnly},
		{"expected-error.json", []string{"expected-error.json"}, outcomeJSOnly},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := declaredOutcome(writeFixture(t, tc.files...))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("outcome = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestDeclaredOutcomeRefusesTwoDeclarations(t *testing.T) {
	// The state the docs forbid and nothing used to catch: a render
	// fixture converted to a refusal fixture without retiring the old
	// reference output. Both harnesses would otherwise claim it.
	dir := writeFixture(t, "expected.txt", "expected-go-error.txt")

	_, err := declaredOutcome(dir)
	if err == nil {
		t.Fatal("expected a refusal for a fixture declaring two outcomes")
	}
	for _, name := range []string{"expected.txt", "expected-go-error.txt"} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("error %q does not name %s", err, name)
		}
	}
}
