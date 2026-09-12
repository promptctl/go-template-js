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

// outcome is what a fixture has declared itself to be about. Which one a
// fixture declares decides what this program records for it, or that it
// records nothing at all.
type outcome int

const (
	// outcomeRender — Go executes the template and its bytes are the reference.
	outcomeRender outcome = iota
	// outcomeRefusal — Go declines the template and its message is the reference.
	outcomeRefusal
	// outcomeJSOnly — asserted against the TS engine alone. Typed-fragment
	// and no-silent-flatten fixtures reference `tagAs`, which has no
	// counterpart in Go's text/template + sprig, so there is nothing here
	// to compare against.
	outcomeJSOnly
)

// The corpus's expected-outcome files, and what each one declares. This
// is the whole set; adding a fifth means adding it here, which is what
// makes the rule below enforceable rather than remembered.
var outcomeFiles = []struct {
	file string
	kind outcome
}{
	{"expected.txt", outcomeRender},
	{"expected-go-error.txt", outcomeRefusal},
	{"expected-fragments.json", outcomeJSOnly},
	{"expected-error.json", outcomeJSOnly},
}

// declaredOutcome reads the one thing a fixture directory says about
// itself. [LAW:parse-dont-validate] The corpus's rule is that a fixture
// carries exactly one expected-outcome file, and this is the single place
// that rule is enforced — a directory that breaks it stops the line here
// rather than reaching the harnesses as a fixture belonging to two of
// them at once.
//
// Declaring nothing is not ambiguity: a render fixture is authored as a
// bare template.tmpl and has no outcome file until this program writes
// one, so silence means render.
func declaredOutcome(dir string) (outcome, error) {
	kind := outcomeRender
	var declared []string
	for _, candidate := range outcomeFiles {
		present, err := exists(filepath.Join(dir, candidate.file))
		if err != nil {
			return 0, err
		}
		if present {
			declared = append(declared, candidate.file)
			kind = candidate.kind
		}
	}
	if len(declared) > 1 {
		return 0, fmt.Errorf(
			"declares %d expected-outcome files (%s) — a fixture carries exactly one, "+
				"so the harnesses cannot tell which outcome it is about; "+
				"delete the one that no longer applies",
			len(declared), strings.Join(declared, ", "))
	}
	return kind, nil
}

// generate records Go's outcome for one fixture, reporting whether that
// outcome was a refusal.
func generate(dir string) (bool, error) {
	kind, err := declaredOutcome(dir)
	if err != nil {
		return false, err
	}
	if kind == outcomeJSOnly {
		return false, nil
	}

	templatePath := filepath.Join(dir, "template.tmpl")
	scopePath := filepath.Join(dir, "scope.json")
	configPath := filepath.Join(dir, "config.json")
	expectedPath := filepath.Join(dir, "expected.txt")
	refusalPath := filepath.Join(dir, "expected-go-error.txt")

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

	if kind == outcomeRender {
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
//
// The node context is closed by `contextEnd`, which can appear a second
// time — inside the node text (`{{ trim ">: oops" }}`) or inside the
// message. When it does, the boundary is genuinely ambiguous and neither
// the first nor the last occurrence is right in general, so this refuses
// to guess rather than picking the likelier branch and being quietly
// wrong in the other case.
func goErrorCore(name string, execErr error) (string, error) {
	const contextEnd = ">: "
	full := execErr.Error()
	marker := fmt.Sprintf("executing %q at <", name)
	start := strings.Index(full, marker)
	if start < 0 {
		return "", fmt.Errorf("execution error has no recognisable context prefix: %q", full)
	}
	rest := full[start+len(marker):]
	if n := strings.Count(rest, contextEnd); n != 1 {
		return "", fmt.Errorf(
			"cannot tell where the node context ends: expected exactly one %q after the "+
				"marker, found %d, so the wrapper boundary is not determinable in %q",
			contextEnd, n, full)
	}
	core := rest[strings.Index(rest, contextEnd)+len(contextEnd):]
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
