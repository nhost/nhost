package graph

// MapStore is a map-based implementation of DataStore.
type MapStore struct {
	apps map[string]*App
}

// NewMapStore creates an empty MapStore for use with lazy loading.
func NewMapStore() *MapStore {
	return &MapStore{
		apps: make(map[string]*App),
	}
}

// NewMapStoreFromData creates a pre-populated MapStore from existing data.
func NewMapStoreFromData(data Data) *MapStore {
	store := &MapStore{
		apps: make(map[string]*App, len(data)),
	}

	for _, app := range data {
		if app != nil {
			store.apps[app.AppID] = app
		}
	}

	return store
}

func (m *MapStore) GetApp(appID string) (*App, error) {
	app, ok := m.apps[appID]
	if !ok {
		return nil, ErrAppNotFound
	}

	return app, nil
}

func (m *MapStore) SetApp(appID string, app *App) {
	m.apps[appID] = app
}

func (m *MapStore) DeleteApp(appID string) {
	delete(m.apps, appID)
}

func (m *MapStore) Range(fn func(appID string, app *App) bool) {
	for id, app := range m.apps {
		if !fn(id, app) {
			return
		}
	}
}

func (m *MapStore) Len() int {
	return len(m.apps)
}
