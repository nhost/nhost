package notifications

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"maps"
	"os"
	"path"
	"path/filepath"

	emailtemplates "github.com/nhost/nhost/services/auth/email-templates"
	"github.com/valyala/fasttemplate"
)

type TemplateName string

const (
	TemplateNameEmailVerify        TemplateName = "email-verify"
	TemplateNameEmailConfirmChange TemplateName = "email-confirm-change"
	TemplateNameElevateOTP         TemplateName = "elevate-otp"
	TemplateNameSigninPasswordless TemplateName = "signin-passwordless"
	TemplateNameSigninOTP          TemplateName = "signin-otp"
	TemplateNamePasswordReset      TemplateName = "password-reset"
)

const embeddedLocale = "en"

type Templates struct {
	templates         map[string]*fasttemplate.Template
	embeddedTemplates map[string]*fasttemplate.Template
	defaultLocale     string
	logger            *slog.Logger
}

// NewTemplatesFromFilesystem loads custom templates from basePath. An empty
// basePath uses only the embedded defaults.
func NewTemplatesFromFilesystem(
	basePath string,
	defaultLocale string,
	logger *slog.Logger,
) (*Templates, error) {
	embeddedTemplates, err := loadTemplates(emailtemplates.FS, embeddedLocale)
	if err != nil {
		return nil, fmt.Errorf("error loading embedded templates: %w", err)
	}

	templates := make(map[string]*fasttemplate.Template)
	if basePath != "" {
		basePath, err = filepath.EvalSymlinks(basePath)
		if err != nil {
			return nil, fmt.Errorf("error resolving symlinks in base path: %w", err)
		}

		templates, err = loadTemplates(os.DirFS(basePath), ".")
		if err != nil {
			return nil, fmt.Errorf("error loading templates from %s: %w", basePath, err)
		}
	}

	return &Templates{
		templates:         templates,
		embeddedTemplates: embeddedTemplates,
		defaultLocale:     defaultLocale,
		logger:            logger,
	}, nil
}

func loadTemplates(files fs.FS, root string) (map[string]*fasttemplate.Template, error) {
	templates := make(map[string]*fasttemplate.Template)
	if err := fs.WalkDir(files, root, func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if entry.IsDir() || (entry.Name() != "body.html" && entry.Name() != "body.txt" &&
			entry.Name() != "subject.txt") {
			return nil
		}

		contents, err := fs.ReadFile(files, name)
		if err != nil {
			return fmt.Errorf("error reading template %s: %w", name, err)
		}

		templates[name] = fasttemplate.New(string(contents), "${", "}")

		return nil
	}); err != nil {
		return nil, fmt.Errorf("error walking templates: %w", err)
	}

	return templates, nil
}

func (t *Templates) GetRawTemplates() map[string]*fasttemplate.Template {
	return t.templates
}

// templateSource is one step of the fallback chain used by find.
type templateSource struct {
	name      string
	templates map[string]*fasttemplate.Template
	locale    string
}

// get returns all files of the template in dir, or false if any of them is
// missing so a template is never rendered from a mix of sources.
func (s templateSource) get(dir string, files []string) ([]*fasttemplate.Template, bool) {
	found := make([]*fasttemplate.Template, len(files))
	for i, file := range files {
		template, ok := s.templates[path.Join(s.locale, dir, file)]
		if !ok {
			return nil, false
		}

		found[i] = template
	}

	return found, true
}

// find returns the files of the template in dir, in the order requested, and
// the locale they were found in. It tries the custom templates in the requested
// locale, then in the default locale, then the embedded defaults.
func (t *Templates) find(
	ctx context.Context, locale string, dir string, files ...string,
) ([]*fasttemplate.Template, string, error) {
	sources := []templateSource{
		{name: "custom", templates: t.templates, locale: locale},
		{name: "custom", templates: t.templates, locale: t.defaultLocale},
		{name: "embedded", templates: t.embeddedTemplates, locale: embeddedLocale},
	}

	for i, source := range sources {
		found, ok := source.get(dir, files)
		if !ok {
			continue
		}

		// without custom templates the embedded defaults are expected, not a fallback
		if i > 0 && len(t.templates) > 0 {
			t.logger.WarnContext(ctx, "template not found, falling back",
				slog.String("template", dir),
				slog.String("locale", locale),
				slog.String("fallbackSource", source.name),
				slog.String("fallbackLocale", source.locale))
		}

		return found, source.locale, nil
	}

	return nil, "", ErrTemplateNotFound
}

type TemplateData struct {
	Link        string
	DisplayName string
	Email       string
	NewEmail    string
	Ticket      string
	RedirectTo  string
	Locale      string
	ServerURL   string
	ClientURL   string
}

func (data TemplateData) ToMap(extra map[string]any) map[string]any {
	m := map[string]any{
		"link":        data.Link,
		"displayName": data.DisplayName,
		"email":       data.Email,
		"newEmail":    data.NewEmail,
		"ticket":      data.Ticket,
		"redirectTo":  data.RedirectTo,
		"locale":      data.Locale,
		"serverUrl":   data.ServerURL,
		"clientUrl":   data.ClientURL,
	}

	maps.Copy(m, extra)

	return m
}

func (t *Templates) Render(
	ctx context.Context,
	locale string,
	templateName TemplateName,
	data TemplateData,
) (string, string, error) {
	found, locale, err := t.find(ctx, locale, string(templateName), "body.html", "subject.txt")
	if err != nil {
		return "", "", fmt.Errorf("error getting email template: %w", err)
	}

	m := data.ToMap(map[string]any{"locale": locale})
	body := found[0].ExecuteString(m)
	subject := found[1].ExecuteString(m)

	return body, subject, nil
}

type TemplateSMSData struct {
	Code string
}

func (data TemplateSMSData) ToMap() map[string]any {
	return map[string]any{
		"code": data.Code,
	}
}

func (t *Templates) RenderSMS(
	ctx context.Context,
	locale string,
	data TemplateSMSData,
) (string, error) {
	found, _, err := t.find(ctx, locale, "signin-passwordless-sms", "body.txt")
	if err != nil {
		return "", fmt.Errorf("error getting SMS template: %w", err)
	}

	m := data.ToMap()
	body := found[0].ExecuteString(m)

	return body, nil
}
