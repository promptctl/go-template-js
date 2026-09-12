// Go-signature extractor for the arity conformance fixture.
//
// Every `TemplateFunc.arity` in this engine is a map whose territory is
// the Go function it mirrors. This program redraws that map from the
// territory so no one has to survey 168 signatures by hand — and so the
// survey cannot silently go stale when sprig or Go is bumped.
//
// Sprig comes from `reflect` over the real `sprig.GenericFuncMap()`,
// which resolves the entries a parser cannot: stdlib method values
// (`"upper": strings.ToUpper`) and inline lambdas (`"add": func(i
// ...interface{}) int64`).
//
// text/template's builtins are unexported, so they come from an AST walk
// of `$GOROOT/src/text/template/funcs.go` — mechanical for the same
// reason. Note this resolves `"call": emptyCall` (2 params), not the
// `call(name, fn, args...)` helper the evaluator splices a name into; the
// map literal is what the arity gate reads, so the map literal is the
// territory.
//
// Run: pnpm arity:regen
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"

	"github.com/Masterminds/sprig/v3"
)

// sig is the only thing Go's arity gate consults about a function: how
// many parameters it declares, and whether the last one absorbs the
// rest. Everything the TS `Arity` union can say is derived from these
// two numbers.
type sig struct {
	NumIn    int  `json:"numIn"`
	Variadic bool `json:"variadic"`
}

type fixture struct {
	// Provenance, so a reader of the fixture can tell which territory
	// was mapped without digging through git history.
	GoVersion   string         `json:"goVersion"`
	SprigModule string         `json:"sprigModule"`
	Funcs       map[string]sig `json:"funcs"`
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "arity extraction failed: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	goroot, err := goEnv("GOROOT")
	if err != nil {
		return err
	}

	builtins, err := extractBuiltins(goroot)
	if err != nil {
		return err
	}

	funcs, err := merge(builtins, extractSprig())
	if err != nil {
		return err
	}

	out := fixture{
		GoVersion:   strings.TrimPrefix(runtimeVersion(), "go"),
		SprigModule: sprigModule(),
		Funcs:       funcs,
	}

	encoded, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}

	dest := filepath.Join("..", "..", "src", "evaluator", "go-arity.fixture.json")
	return os.WriteFile(dest, append(encoded, '\n'), 0o644)
}

// merge flattens both Go registries into the single namespace the JS
// side resolves against — it registers `len` among its sprig lists and
// `toString` among its builtins, mirroring neither split exactly.
//
// A name in both registries is only safe to flatten while the two agree.
// `slice` is the one such name today and they do agree; a sprig or Go
// bump that splits them must stop the line rather than let whichever
// signature wins silently retype a slot. [LAW:no-silent-failure]
func merge(builtins, sprig map[string]sig) (map[string]sig, error) {
	out := map[string]sig{}
	for name, s := range sprig {
		out[name] = s
	}
	for name, s := range builtins {
		if existing, dup := out[name]; dup && existing != s {
			return nil, fmt.Errorf(
				"%q: text/template declares %+v but sprig declares %+v — "+
					"the flattened namespace can no longer represent both; "+
					"split the fixture before regenerating", name, s, existing)
		}
		out[name] = s
	}
	return out, nil
}

// extractSprig reflects over the live sprig func map. `reflect.TypeOf`
// reports the same NumIn/IsVariadic the Go template evaluator itself
// checks a call against, so this is the gate's own view, not a reading
// of it.
func extractSprig() map[string]sig {
	out := map[string]sig{}
	for name, fn := range sprig.GenericFuncMap() {
		t := reflect.TypeOf(fn)
		out[name] = sig{NumIn: t.NumIn(), Variadic: t.IsVariadic()}
	}
	return out
}

// extractBuiltins walks the `builtins()` map literal in text/template
// and resolves each value to a function declaration. Values are either
// an identifier declared in text/template itself or a `fmt.Sprint*`
// selector; both packages are parsed so either resolves.
func extractBuiltins(goroot string) (map[string]sig, error) {
	fset := token.NewFileSet()

	tmplFuncs, err := funcDecls(fset, filepath.Join(goroot, "src", "text", "template"))
	if err != nil {
		return nil, err
	}
	fmtFuncs, err := funcDecls(fset, filepath.Join(goroot, "src", "fmt"))
	if err != nil {
		return nil, err
	}

	entries, err := builtinsMapLiteral(fset, filepath.Join(goroot, "src", "text", "template", "funcs.go"))
	if err != nil {
		return nil, err
	}

	out := map[string]sig{}
	for name, ref := range entries {
		var decl *ast.FuncType
		switch v := ref.(type) {
		case *ast.Ident:
			decl = tmplFuncs[v.Name]
		case *ast.SelectorExpr:
			pkg, ok := v.X.(*ast.Ident)
			if !ok || pkg.Name != "fmt" {
				return nil, fmt.Errorf("builtin %q: unresolvable package reference", name)
			}
			decl = fmtFuncs[v.Sel.Name]
		default:
			return nil, fmt.Errorf("builtin %q: unexpected map value %T", name, ref)
		}
		if decl == nil {
			return nil, fmt.Errorf("builtin %q: no function declaration found", name)
		}
		out[name] = signatureOf(decl)
	}
	return out, nil
}

// builtinsMapLiteral returns name -> value-expression for the composite
// literal returned by `func builtins()`.
func builtinsMapLiteral(fset *token.FileSet, path string) (map[string]ast.Expr, error) {
	file, err := parser.ParseFile(fset, path, nil, 0)
	if err != nil {
		return nil, err
	}

	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Name.Name != "builtins" || fn.Recv != nil {
			continue
		}
		ret, ok := fn.Body.List[0].(*ast.ReturnStmt)
		if !ok || len(ret.Results) != 1 {
			return nil, fmt.Errorf("builtins(): unexpected body shape")
		}
		lit, ok := ret.Results[0].(*ast.CompositeLit)
		if !ok {
			return nil, fmt.Errorf("builtins(): return is not a composite literal")
		}
		out := map[string]ast.Expr{}
		for _, elt := range lit.Elts {
			kv, ok := elt.(*ast.KeyValueExpr)
			if !ok {
				return nil, fmt.Errorf("builtins(): non key-value element")
			}
			key, ok := kv.Key.(*ast.BasicLit)
			if !ok || key.Kind != token.STRING {
				return nil, fmt.Errorf("builtins(): non-string key")
			}
			name, err := strconv.Unquote(key.Value)
			if err != nil {
				return nil, err
			}
			out[name] = kv.Value
		}
		return out, nil
	}
	return nil, fmt.Errorf("builtins(): declaration not found in %s", path)
}

// funcDecls indexes every top-level function in a package directory by
// name. Methods are skipped — no builtin refers to one.
func funcDecls(fset *token.FileSet, dir string) (map[string]*ast.FuncType, error) {
	pkgs, err := parser.ParseDir(fset, dir, func(fi os.FileInfo) bool {
		return !strings.HasSuffix(fi.Name(), "_test.go")
	}, 0)
	if err != nil {
		return nil, err
	}
	out := map[string]*ast.FuncType{}
	for _, pkg := range pkgs {
		for _, file := range pkg.Files {
			for _, decl := range file.Decls {
				fn, ok := decl.(*ast.FuncDecl)
				if !ok || fn.Recv != nil {
					continue
				}
				out[fn.Name.Name] = fn.Type
			}
		}
	}
	return out, nil
}

// signatureOf counts declared parameters the way `reflect` does: a
// grouped `func(a, b T)` is two, and a trailing `...T` is one parameter
// that also sets Variadic.
func signatureOf(t *ast.FuncType) sig {
	out := sig{}
	if t.Params == nil {
		return out
	}
	for _, field := range t.Params.List {
		n := len(field.Names)
		if n == 0 {
			n = 1
		}
		out.NumIn += n
		if _, ok := field.Type.(*ast.Ellipsis); ok {
			out.Variadic = true
		}
	}
	return out
}

func goEnv(key string) (string, error) {
	out, err := exec.Command("go", "env", key).Output()
	if err != nil {
		return "", fmt.Errorf("go env %s: %w", key, err)
	}
	value := strings.TrimSpace(string(out))
	if value == "" {
		return "", fmt.Errorf("go env %s: empty", key)
	}
	return value, nil
}

// sprigModule reports the exact sprig version this extraction read, from
// the build's own module graph rather than go.mod's text.
func sprigModule() string {
	out, err := exec.Command("go", "list", "-m", "github.com/Masterminds/sprig/v3").Output()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}

func runtimeVersion() string {
	out, err := exec.Command("go", "env", "GOVERSION").Output()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}
