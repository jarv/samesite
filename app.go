package main

import (
	"embed"
	"encoding/base64"
	"encoding/json"
	"flag"

	"html/template"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path"
	"time"

	sprig "github.com/Masterminds/sprig/v3"
	"github.com/yeqown/go-qrcode/v2"
	"github.com/yeqown/go-qrcode/writer/standard"
)

const (
	qrPath       = "/q/"
	oneYearCache = "public, max-age=31536000"
)

type Cookie struct {
	Name        string
	SameSite    http.SameSite
	SameSiteStr string
}

var (
	addr          = flag.String("addr", "localhost:8750", "http service address")
	primaryDomain = flag.String("primaryDomain", "localhost:8750", "domain we redirect to for /redirect")
	altDomain     = flag.String("altDomain", "localhost:8750", "alternate domain that is used for the IFrame")
	qrImgDir      = flag.String("qrImgDir", "qrImgDir", "directory to store QR images")
	jsonLog       = flag.Bool("json", false, "use json logs")
	cacheBust     = time.Now().Format("20060102150405")

	//go:embed static
	staticFiles embed.FS

	//go:embed tmpl/*.tmpl
	tmplFiles embed.FS

	logger    *slog.Logger
	templates = template.Must(
		template.New("base").
			Funcs(sprig.FuncMap()).
			ParseFS(tmplFiles, "tmpl/*.tmpl"),
	)

	cookies = []Cookie{
		{"sameSiteStrict", http.SameSiteStrictMode, "Strict"},
		{"sameSiteLax", http.SameSiteLaxMode, "Lax"},
		{"sameSiteNone", http.SameSiteNoneMode, "None"},
		{"sameSiteDefault", http.SameSiteDefaultMode, ""},
	}
)

func arr(els ...any) []any {
	return els
}

func gotCookie(cookieName string, r *http.Request) bool {
	_, err := r.Cookie(cookieName)

	return err == nil
}

func createImgDir() {
	_, err := os.Stat(*qrImgDir)
	if os.IsNotExist(err) {
		err := os.MkdirAll(*qrImgDir, 0755)
		if err != nil {
			logger.Error("Error creating directory", "qrImgDir", *qrImgDir, "err", err)
			os.Exit(1)
		}
	} else if err != nil {
		logger.Error("Error stating dir", "qrImgDir", *qrImgDir, "err", err)
		os.Exit(1)
	}
}

func setupLogging() {
	slogOpts := &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelDebug,
	}
	var slogHandler slog.Handler
	if *jsonLog {
		slogHandler = slog.NewJSONHandler(os.Stdout, slogOpts)
	} else {
		slogHandler = slog.NewTextHandler(os.Stdout, slogOpts)
	}
	logger = slog.New(slogHandler)
}

type CookieData struct {
	Name     string
	SameSite string
	Received bool
}

func genCookieData(r *http.Request) []CookieData {
	cookieData := make([]CookieData, 0, 4)
	for _, c := range cookies {
		d := CookieData{Name: c.Name, SameSite: c.SameSiteStr}
		d.Received = gotCookie(c.Name, r)
		cookieData = append(cookieData, d)
	}

	return cookieData
}

func cookieTable(w http.ResponseWriter, r *http.Request) {
	setCookies(w, r)
	d := struct {
		Cookies []CookieData
	}{
		Cookies: genCookieData(r),
	}
	if err := templates.ExecuteTemplate(w, "cookieTable.html.tmpl", d); err != nil {
		logger.Error("Error generating cookie table!", "err", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
}

func main() {
	flag.Parse()

	setupLogging()
	createImgDir()
	mux := http.NewServeMux()

	// File server for static assets
	mux.Handle("GET /static/", cacheControlMiddleware(
		http.FileServer(http.FS(staticFiles)),
		oneYearCache,
	))

	qrFilesServer := http.FileServer(http.Dir(*qrImgDir))
	mux.Handle("GET "+qrPath, http.StripPrefix(qrPath, qrFilesServer))

	mux.HandleFunc("POST /post", func(w http.ResponseWriter, r *http.Request) {
		cookieTable(w, r)
	})

	mux.HandleFunc("GET /redirect/{fragment}", func(w http.ResponseWriter, r *http.Request) {
		fragment := r.PathValue("fragment")
		redirUrl := &url.URL{
			Scheme:   scheme(r),
			Host:     *primaryDomain,
			RawQuery: r.URL.RawQuery,
			Fragment: fragment,
		}

		http.Redirect(w, r, redirUrl.String(), http.StatusFound)
	})

	mux.HandleFunc("GET /link/{fragment}", func(w http.ResponseWriter, r *http.Request) {
		fragment := r.PathValue("fragment")
		linkUrl := &url.URL{
			Scheme:   scheme(r),
			Host:     *primaryDomain,
			RawQuery: r.URL.RawQuery,
			Fragment: fragment,
		}

		d := struct {
			CacheBust     string
			LinkUrl       string
			PrimaryDomain string
			Host          string
		}{
			CacheBust:     cacheBust,
			LinkUrl:       linkUrl.String(),
			PrimaryDomain: *primaryDomain,
			Host:          r.Host,
		}

		if err := templates.ExecuteTemplate(w, "link.html.tmpl", d); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			logger.Error("Error executing template", "err", err)
			return
		}
	})

	mux.HandleFunc("/iframe", func(w http.ResponseWriter, r *http.Request) {
		d := struct {
			Cookies      []CookieData
			CacheBust    string
			SecureCookie bool
			Host         string
		}{
			Cookies:      genCookieData(r),
			CacheBust:    cacheBust,
			SecureCookie: secureCookie(r),
			Host:         "", // Not needed in Iframe
		}

		setCookies(w, r)
		if err := templates.ExecuteTemplate(w, "indexIFrame.html.tmpl", d); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			logger.Error("Error executing template", "err", err)
			return
		}
	})

	mux.HandleFunc("GET /get", func(w http.ResponseWriter, r *http.Request) {
		cookieTable(w, r)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if *primaryDomain != *altDomain && r.Host == *altDomain {
			redirUrl := &url.URL{
				Scheme: scheme(r),
				Host:   *primaryDomain,
			}
			http.Redirect(w, r, redirUrl.String(), http.StatusFound)
			return
		}

		qrCodeURL, err := genQRCode("qr-"+scheme(r)+"-playground.jpg", r, "#playground")
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			logger.Error("unable to generate qr code", "err", err)
		}
		qrCodeURLExplain, err := genQRCode("qr-"+scheme(r)+"-explain5.jpg", r, "#explain5")
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			logger.Error("unable to generate qr code", "err", err)
		}

		altUrl := &url.URL{
			Scheme: scheme(r),
			Host:   *altDomain,
		}

		d := struct {
			QRCodeURL         string
			QRCodeURLExplain  string
			Cookies           []CookieData
			CacheBust         string
			AltUrl            string
			SecureCookie      bool
			PartitionedCookie bool
			Host              string
		}{
			QRCodeURL:         qrCodeURL.String(),
			QRCodeURLExplain:  qrCodeURLExplain.String(),
			Cookies:           genCookieData(r),
			CacheBust:         cacheBust,
			AltUrl:            altUrl.String(),
			SecureCookie:      secureCookie(r),
			PartitionedCookie: partitionedCookie(r),
			Host:              r.Host,
		}

		setCookies(w, r)
		if err := templates.ExecuteTemplate(w, "index.html.tmpl", d); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			logger.Error("Error executing template", "err", err)
			return
		}
	})

	server := &http.Server{
		Addr:              *addr,
		ReadHeaderTimeout: 3 * time.Second,
		Handler:           mux,
		// Handler: mux,
	}

	logger.Info("Server started", "addr", "http://"+*addr)
	if err := server.ListenAndServe(); err != nil {
		logger.Error("Unable to setup listener", "err", err)
		os.Exit(1)
	}
}

func cacheControlMiddleware(next http.Handler, cacheControl string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", cacheControl)
		next.ServeHTTP(w, r)
	})
}

func scheme(r *http.Request) string {
	type CfVisitor struct {
		Scheme string `json:"scheme"`
	}
	var cfVisitor CfVisitor
	err := json.Unmarshal([]byte(r.Header.Get("Cf-Visitor")), &cfVisitor)
	if err == nil {
		return cfVisitor.Scheme
	}

	scheme := r.Header.Get("X-Forwarded-Proto")
	if scheme == "" {
		return "http"
	}

	return scheme
}

func host(r *http.Request) string {
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	return host
}

// Generates a QR code image that targets the http.Request URL
func genQRCode(imgFname string, r *http.Request, destPath string) (*url.URL, error) {
	imgPath := path.Join(*qrImgDir, imgFname)

	u := &url.URL{
		Scheme: scheme(r),
		Host:   host(r),
		Path:   qrPath + imgFname,
	}
	params := url.Values{}
	u.RawQuery = params.Encode()

	destURL := &url.URL{
		Scheme: scheme(r),
		Host:   host(r),
	}

	// If the image file exists return it
	_, err := os.Stat(imgPath)
	if err == nil {
		return u, nil
	}

	logger.Info("Generating new QR Code image", "fname", imgFname, "url", destURL.String()+destPath)
	qrc, err := qrcode.NewWith(
		destURL.String()+destPath,
		qrcode.WithEncodingMode(qrcode.EncModeByte),
		qrcode.WithErrorCorrectionLevel(qrcode.ErrorCorrectionQuart),
	)
	if err != nil {
		return nil, err
	}

	qrWriter, err := standard.New(imgPath,
		standard.WithBuiltinImageEncoder(standard.JPEG_FORMAT),
		standard.WithQRWidth(10),
		standard.WithFgColorRGBHex("#2E1065"),
		standard.WithBorderWidth(4),
	)
	if err != nil {
		return nil, err
	}

	if err = qrc.Save(qrWriter); err != nil {
		return nil, err
	}

	return u, nil
}

type CookieAttr struct {
	SameSite    string `json:"sameSite"`
	Secure      bool   `json:"secure"`
	Partitioned bool   `json:"partitioned"`
}

func secureCookie(r *http.Request) bool {
	qV := r.URL.Query()
	var sc string

	if r.Method == "POST" {
		sc = r.PostFormValue("sc")
	} else {
		sc = qV.Get("sc")
	}

	return sc != "false"
}

func partitionedCookie(r *http.Request) bool {
	qV := r.URL.Query()
	var pc string

	if r.Method == "POST" {
		pc = r.PostFormValue("pc")
	} else {
		pc = qV.Get("pc")
	}

	return pc != "false"
}

func setCookies(w http.ResponseWriter, r *http.Request) {
	for _, c := range cookies {
		attr := CookieAttr{
			SameSite:    c.SameSiteStr,
			Secure:      secureCookie(r),
			Partitioned: partitionedCookie(r),
		}
		jsonData, _ := json.Marshal(attr)
		cookie := &http.Cookie{
			Name:        c.Name,
			Value:       base64.StdEncoding.EncodeToString(jsonData),
			Expires:     time.Now().Add(7 * 24 * time.Hour),
			Path:        "/",
			SameSite:    c.SameSite,
			Secure:      attr.Secure,
			Partitioned: attr.Partitioned,
		}

		http.SetCookie(w, cookie)
	}
}
