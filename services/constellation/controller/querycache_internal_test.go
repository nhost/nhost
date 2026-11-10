package controller

import (
	"errors"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

func queryCacheSchema(tb testing.TB, sdl string) *ast.Schema {
	tb.Helper()

	schema, err := gqlparser.LoadSchema(&ast.Source{Input: sdl})
	if err != nil {
		tb.Fatalf("LoadSchema: %v", err)
	}

	return schema
}

func assertQueryCacheEntry(t *testing.T, got, want queryCacheEntry) {
	t.Helper()

	if got.doc != want.doc || !slices.Equal(got.errs, want.errs) {
		t.Fatalf("cache entry = %v, want shared document/errors %v", got, want)
	}
}

func TestQueryCacheLoadMissCoalesces(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		query   string
		wantErr bool
	}{
		{name: "valid document", query: `{ value }`},
		{name: "syntax error", query: `{`, wantErr: true},
		{name: "validation error", query: `{ missing }`, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			synctest.Test(t, func(t *testing.T) {
				cache := newQueryCache()
				schema := queryCacheSchema(t, `type Query { value: String }`)
				key := queryCacheKey{query: tt.query, role: "admin"}
				release := make(chan struct{})

				var calls atomic.Int32

				load := func() queryCacheEntry {
					calls.Add(1)
					<-release

					doc, errs := gqlparser.LoadQueryWithRules(schema, tt.query, defaultRules())

					return queryCacheEntry{doc: doc, errs: errs}
				}

				const workers = 32

				results := make(chan queryCacheEntry, workers)

				var wg sync.WaitGroup
				for range workers {
					wg.Go(func() { results <- cache.loadMiss(key, load) })
				}

				// Every caller has joined the in-flight load before it can finish.
				synctest.Wait()

				if got := calls.Load(); got != 1 {
					t.Errorf("parse calls while blocked = %d, want 1", got)
				}

				close(release)
				wg.Wait()
				close(results)

				want := <-results
				if (len(want.errs) != 0) != tt.wantErr {
					t.Fatalf("validation errors = %v, want error %v", want.errs, tt.wantErr)
				}

				for got := range results {
					assertQueryCacheEntry(t, got, want)
				}

				// A caller delayed after its initial miss must recheck the LRU.
				assertQueryCacheEntry(t, cache.loadMiss(key, load), want)

				if got := calls.Load(); got != 1 {
					t.Fatalf("parse calls after delayed miss = %d, want 1", got)
				}
			})
		})
	}
}

func TestQueryCacheLoadMissIndependentKeys(t *testing.T) {
	t.Parallel()

	key := queryCacheKey{query: `{ value }`, role: "admin"}

	tests := []struct {
		name     string
		key      queryCacheKey
		firstKey queryCacheKey
		newState bool
	}{
		{name: "different query", key: queryCacheKey{query: `{ other }`, role: "admin"}},
		{name: "different role", key: queryCacheKey{query: key.query, role: "user"}},
		{name: "different state", key: key, newState: true},
		{
			name:     "NUL separator collision",
			firstKey: queryCacheKey{query: "\u0000{ value }", role: "user"},
			key:      queryCacheKey{query: `{ value }`, role: "user\u0000"},
		},
		{
			name:     "concatenation boundary collision",
			firstKey: queryCacheKey{query: "bc", role: "a"},
			key:      queryCacheKey{query: "c", role: "ab"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cache := newQueryCache()
			started := make(chan struct{})
			release := make(chan struct{})

			var wg sync.WaitGroup
			defer func() {
				close(release)
				wg.Wait()
			}()

			firstKey := tt.firstKey
			if firstKey == (queryCacheKey{}) {
				firstKey = key
			}

			wg.Go(func() {
				cache.loadMiss(firstKey, func() queryCacheEntry {
					close(started)
					<-release

					return queryCacheEntry{}
				})
			})
			<-started

			otherCache := cache
			if tt.newState {
				otherCache = newQueryCache()
			}

			done := make(chan struct{})
			wg.Go(func() {
				otherCache.loadMiss(tt.key, func() queryCacheEntry { return queryCacheEntry{} })
				close(done)
			})

			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Fatal("unrelated cache load blocked behind an in-flight query")
			}
		})
	}
}

func TestQueryCacheLoadMissPanic(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		cache := newQueryCache()
		key := queryCacheKey{query: `{ value }`, role: "admin"}
		wantPanic := errors.ErrUnsupported
		release := make(chan struct{})

		var calls, panics atomic.Int32

		load := func() queryCacheEntry {
			calls.Add(1)
			<-release
			panic(wantPanic)
		}

		const workers = 32

		var wg sync.WaitGroup
		for range workers {
			wg.Go(func() {
				defer func() {
					got, ok := recover().(error)
					if !ok || !errors.Is(got, wantPanic) {
						t.Errorf("panic = %v, want wrapped %v", got, wantPanic)
					}

					panics.Add(1)
				}()

				cache.loadMiss(key, load)
			})
		}

		synctest.Wait()
		close(release)
		wg.Wait()

		if calls.Load() != 1 || panics.Load() != workers {
			t.Fatalf("load calls = %d, recovered panics = %d", calls.Load(), panics.Load())
		}

		if _, ok := cache.entries.Get(key); ok {
			t.Fatal("panicking load populated the cache")
		}

		want := queryCacheEntry{doc: &ast.QueryDocument{}}
		assertQueryCacheEntry(t, cache.loadMiss(key, func() queryCacheEntry { return want }), want)
	})
}

func TestLoadQueryCacheIsolation(t *testing.T) {
	t.Parallel()

	cache := newQueryCache()
	original := queryCacheSchema(t, `type Query { value: String }`)
	restricted := queryCacheSchema(t, `type Query { other: String }`)
	reloaded := queryCacheSchema(t, `type Query { value: Int }`)

	tests := []struct {
		name     string
		cache    *queryCache
		schema   *ast.Schema
		role     string
		wantType string
		wantErr  bool
	}{
		{name: "original state", cache: cache, schema: original, role: "admin", wantType: "String"},
		{name: "restricted role", cache: cache, schema: restricted, role: "user", wantErr: true},
		{
			name:     "reloaded state",
			cache:    newQueryCache(),
			schema:   reloaded,
			role:     "admin",
			wantType: "Int",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doc, errs := loadQuery(tt.cache, tt.schema, `{ value }`, tt.role)
			if (len(errs) != 0) != tt.wantErr {
				t.Fatalf("loadQuery errors = %v, want error %v", errs, tt.wantErr)
			}

			if !tt.wantErr {
				field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
				if !ok || field.Definition.Type.Name() != tt.wantType {
					t.Fatalf("field = %v, want type %s", field, tt.wantType)
				}
			}

			cachedDoc, cachedErrs := loadQuery(tt.cache, tt.schema, `{ value }`, tt.role)
			assertQueryCacheEntry(
				t,
				queryCacheEntry{doc: cachedDoc, errs: cachedErrs},
				queryCacheEntry{doc: doc, errs: errs},
			)
		})
	}
}

func TestLoadQueryVariablesRemainRequestLocal(t *testing.T) {
	t.Parallel()

	cache := newQueryCache()
	schemas := wsTestSchemas(t)

	const query = `query Pick($showUsers: Boolean!) {
		users @include(if: $showUsers) { id }
		posts @skip(if: $showUsers) { id }
	}`

	tests := []struct {
		name      string
		showUsers bool
		wantField string
	}{
		{name: "include users", showUsers: true, wantField: "users"},
		{name: "include posts", showUsers: false, wantField: "posts"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			op, _, vars, err := parseAndValidateQuery(
				schemas, cache, query, "Pick", map[string]any{"showUsers": tt.showUsers}, "admin",
			)
			if err != nil {
				t.Fatalf("parseAndValidateQuery: %v", err)
			}

			if len(op.SelectionSet) != 1 || vars["showUsers"] != tt.showUsers {
				t.Fatalf("unexpected request-local operation/variables: %v, %v", op, vars)
			}

			field, ok := op.SelectionSet[0].(*ast.Field)
			if !ok || field.Name != tt.wantField {
				t.Fatalf("field = %v, want %s", field, tt.wantField)
			}

			doc, errs := loadQuery(cache, schemas["admin"], query, "admin")
			if len(errs) != 0 || len(doc.Operations[0].SelectionSet) != 2 {
				t.Fatalf("cached document was changed: %v, %v", doc, errs)
			}
		})
	}
}

func TestLoadQueryWarmHitBypassesSingleflight(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		cache := newQueryCache()
		schema := queryCacheSchema(t, `type Query { value: String }`)
		key := queryCacheKey{query: `{ value }`, role: "admin"}

		doc, errs := gqlparser.LoadQueryWithRules(schema, key.query, defaultRules())
		if len(errs) != 0 {
			t.Fatalf("LoadQueryWithRules: %v", errs)
		}

		want := queryCacheEntry{doc: doc, errs: errs}
		started := make(chan struct{})
		release := make(chan struct{})

		var wg sync.WaitGroup
		wg.Go(func() {
			cache.loadMiss(key, func() queryCacheEntry {
				close(started)
				<-release

				return want
			})
		})
		<-started

		// A completed entry must be usable without joining a blocked flight.
		cache.entries.Put(key, want)
		gotDoc, gotErrs := loadQuery(cache, schema, key.query, key.role)

		close(release)
		wg.Wait()
		assertQueryCacheEntry(t, queryCacheEntry{doc: gotDoc, errs: gotErrs}, want)
	})
}
