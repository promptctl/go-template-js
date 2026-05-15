// Reference-output generator for the conformance corpus.
//
// Walks conformance/fixtures/*/template.tmpl, reads scope.json from
// the same directory, executes the template with Go's text/template
// (with Masterminds/sprig registered), and writes expected.txt.
//
// Run: pnpm conformance:regen
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"text/template"

	"github.com/Masterminds/sprig/v3"
)

func main() {
	root, err := findFixturesRoot()
	if err != nil {
		fail(err)
	}

	dirs, err := os.ReadDir(root)
	if err != nil {
		fail(fmt.Errorf("read fixtures dir %s: %w", root, err))
	}

	var names []string
	for _, d := range dirs {
		if d.IsDir() {
			names = append(names, d.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		if err := generate(filepath.Join(root, name)); err != nil {
			fail(fmt.Errorf("fixture %s: %w", name, err))
		}
	}
	fmt.Printf("regenerated %d fixtures\n", len(names))
}

// findFixturesRoot walks up from the current working directory looking
// for `conformance/fixtures`. This makes the program runnable from
// either the repo root or `conformance/gen`.
func findFixturesRoot() (string, error) {
	cur, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		candidate := filepath.Join(cur, "conformance", "fixtures")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate, nil
		}
		parent := filepath.Dir(cur)
		if parent == cur {
			return "", fmt.Errorf("could not find conformance/fixtures from %s", cur)
		}
		cur = parent
	}
}

func generate(dir string) error {
	// Typed-fragment fixtures (those that supply expected-fragments.json)
	// are meaningful only for the TS engine's generic-T harness — they
	// reference funcs that don't exist in Go's text/template + sprig.
	// Skip them in the Go reference generator.
	if _, err := os.Stat(filepath.Join(dir, "expected-fragments.json")); err == nil {
		return nil
	}
	// Error-parity fixtures (those that supply expected-error.json) are
	// JS-side behavioral assertions for the no-silent-flatten guard;
	// they reference `tagAs` and have no Go counterpart. Skip them.
	if _, err := os.Stat(filepath.Join(dir, "expected-error.json")); err == nil {
		return nil
	}

	templatePath := filepath.Join(dir, "template.tmpl")
	scopePath := filepath.Join(dir, "scope.json")
	configPath := filepath.Join(dir, "config.json")
	expectedPath := filepath.Join(dir, "expected.txt")

	tplBytes, err := os.ReadFile(templatePath)
	if err != nil {
		return fmt.Errorf("read template: %w", err)
	}

	var scope interface{}
	if scopeBytes, err := os.ReadFile(scopePath); err == nil {
		if err := json.Unmarshal(scopeBytes, &scope); err != nil {
			return fmt.Errorf("parse scope.json: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("read scope.json: %w", err)
	}

	// Optional per-fixture configuration. Mirrors the TS engine's
	// EngineConfig fields that affect *parsing* (currently: delims).
	// Absent file → defaults; the Go reference uses standard {{ }}.
	cfg := fixtureConfig{}
	if cfgBytes, err := os.ReadFile(configPath); err == nil {
		if err := json.Unmarshal(cfgBytes, &cfg); err != nil {
			return fmt.Errorf("parse config.json: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("read config.json: %w", err)
	}

	tpl := template.New(filepath.Base(dir)).Funcs(sprig.FuncMap())
	if cfg.Delims != nil {
		if len(cfg.Delims) != 2 {
			return fmt.Errorf("config.json: delims must be [left, right]")
		}
		tpl = tpl.Delims(cfg.Delims[0], cfg.Delims[1])
	}
	if _, err := tpl.Parse(string(tplBytes)); err != nil {
		return fmt.Errorf("parse template: %w", err)
	}

	out, err := os.Create(expectedPath)
	if err != nil {
		return fmt.Errorf("write expected.txt: %w", err)
	}
	defer out.Close()
	if err := tpl.Execute(out, scope); err != nil {
		return fmt.Errorf("execute template: %w", err)
	}
	return nil
}

// fixtureConfig mirrors the engine-level knobs that affect how the
// reference template is parsed. Kept intentionally minimal: only fields
// that the TS engine also exposes via EngineConfig belong here.
type fixtureConfig struct {
	// Delims, if set, must be a two-element [left, right] pair.
	Delims []string `json:"delims,omitempty"`
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "conformance/gen:", err)
	os.Exit(1)
}
