// Reference-outcome generator for the conformance corpus.
//
// Walks conformance/fixtures/*/template.tmpl, reads scope.json from
// the same directory, executes the template with Go's text/template
// (with Masterminds/sprig registered), and records what Go did.
//
// Go does one of two things with a template, so a fixture records one
// of two outcomes: rendered bytes in expected.txt, or a refusal in
// expected-go-error.txt. Which one a fixture wants is the fixture's own
// declaration — the author creates an empty expected-go-error.txt and
// this program fills it — never a reading of what Go happened to do on
// the day of the last regen. [LAW:no-silent-failure] A sprig or Go bump
// that flips a fixture across that line stops the line here instead of
// quietly rewriting what the corpus claims.
//
// Run: pnpm conformance:regen
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
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

	refusals := 0
	for _, name := range names {
		refused, err := generate(filepath.Join(root, name))
		if err != nil {
			fail(fmt.Errorf("fixture %s: %w", name, err))
		}
		if refused {
			refusals++
		}
	}
	// Report the split, so a fixture crossing between rendering and
	// refusing is visible at regen time and not only in the diff.
	fmt.Printf("regenerated %d fixtures (%d recording a Go refusal)\n", len(names), refusals)
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

// generate records Go's outcome for one fixture, reporting whether that
// outcome was a refusal.
func generate(dir string) (bool, error) {
	// Typed-fragment fixtures (those that supply expected-fragments.json)
	// are meaningful only for the TS engine's generic-T harness — they
	// reference funcs that don't exist in Go's text/template + sprig.
	// Skip them in the Go reference generator.
	if _, err := os.Stat(filepath.Join(dir, "expected-fragments.json")); err == nil {
		return false, nil
	}
	// Error-parity fixtures (those that supply expected-error.json) are
	// JS-side behavioral assertions for the no-silent-flatten guard;
	// they reference `tagAs` and have no Go counterpart. Skip them.
	if _, err := os.Stat(filepath.Join(dir, "expected-error.json")); err == nil {
		return false, nil
	}

	templatePath := filepath.Join(dir, "template.tmpl")
	scopePath := filepath.Join(dir, "scope.json")
	configPath := filepath.Join(dir, "config.json")
	expectedPath := filepath.Join(dir, "expected.txt")
	refusalPath := filepath.Join(dir, "expected-go-error.txt")

	// The fixture's own declaration of which outcome it is about.
	wantRefusal, err := exists(refusalPath)
	if err != nil {
		return false, err
	}

	tplBytes, err := os.ReadFile(templatePath)
	if err != nil {
		return false, fmt.Errorf("read template: %w", err)
	}

	var scope interface{}
	if scopeBytes, err := os.ReadFile(scopePath); err == nil {
		if err := json.Unmarshal(scopeBytes, &scope); err != nil {
			return false, fmt.Errorf("parse scope.json: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return false, fmt.Errorf("read scope.json: %w", err)
	}

	// Optional per-fixture configuration. Mirrors the TS engine's
	// EngineConfig fields that affect *parsing* (currently: delims).
	// Absent file → defaults; the Go reference uses standard {{ }}.
	cfg := fixtureConfig{}
	if cfgBytes, err := os.ReadFile(configPath); err == nil {
		if err := json.Unmarshal(cfgBytes, &cfg); err != nil {
			return false, fmt.Errorf("parse config.json: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return false, fmt.Errorf("read config.json: %w", err)
	}

	name := filepath.Base(dir)
	tpl := template.New(name).Funcs(sprig.FuncMap())
	if cfg.Delims != nil {
		if len(cfg.Delims) != 2 {
			return false, fmt.Errorf("config.json: delims must be [left, right]")
		}
		tpl = tpl.Delims(cfg.Delims[0], cfg.Delims[1])
	}
	// A template Go cannot parse is a broken fixture either way: the
	// refusals this corpus records are execution refusals, which is
	// where argument counts are checked.
	if _, err := tpl.Parse(string(tplBytes)); err != nil {
		return false, fmt.Errorf("parse template: %w", err)
	}

	// Render into memory rather than onto the expected file, so which
	// outcome occurred decides which file is written — and a refusal
	// never leaves a half-written expected.txt behind.
	var rendered bytes.Buffer
	execErr := tpl.Execute(&rendered, scope)

	if !wantRefusal {
		if execErr != nil {
			return false, fmt.Errorf(
				"execute template: %w\n"+
					"    (if this refusal is the fixture's point, declare it by creating "+
					"an empty expected-go-error.txt in the fixture directory)", execErr)
		}
		return false, os.WriteFile(expectedPath, rendered.Bytes(), 0o644)
	}

	if execErr == nil {
		return false, fmt.Errorf(
			"declares expected-go-error.txt but Go rendered it successfully as %q — "+
				"the fixture and the reference implementation disagree about whether "+
				"this template is legal", rendered.String())
	}
	core, err := goErrorCore(name, execErr)
	if err != nil {
		return false, err
	}
	return true, os.WriteFile(refusalPath, []byte(core+"\n"), 0o644)
}

// goErrorCore strips text/template's location-and-context wrapper off an
// execution error, leaving the sentence alone — `wrong number of args for
// upper: want 1 got 2`.
//
// The wrapper is what the TS engine carries as structured `pos` and
// presents with its own caret, so pinning it would pin Go's error
// *formatting* rather than the engine's claim to say the same thing.
// Go flattens both layers with a single fmt.Errorf, leaving no wrapped
// inner error to unwrap, so the prefix — anchored on the template name
// this program chose — is the only handle on the seam.
//
// [LAW:no-silent-failure] An unrecognised shape stops the line; half a
// stripped sentence recorded as Go's message is the kind of wrong that
// would then be enforced on the engine forever.
func goErrorCore(name string, execErr error) (string, error) {
	full := execErr.Error()
	marker := fmt.Sprintf("executing %q at <", name)
	start := strings.Index(full, marker)
	if start < 0 {
		return "", fmt.Errorf("execution error has no recognisable context prefix: %q", full)
	}
	rest := full[start+len(marker):]
	end := strings.Index(rest, ">: ")
	if end < 0 {
		return "", fmt.Errorf("execution error context is unterminated: %q", full)
	}
	core := rest[end+len(">: "):]
	if core == "" {
		return "", fmt.Errorf("execution error carries an empty message: %q", full)
	}
	return core, nil
}

// exists reports whether a path is present, distinguishing "absent" from
// "could not tell" rather than collapsing both into false.
func exists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, fmt.Errorf("stat %s: %w", path, err)
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
